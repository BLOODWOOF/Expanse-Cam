package com.lambda.expansecam;

import net.fabricmc.loader.api.FabricLoader;
import net.minecraft.client.KeyMapping;
import net.minecraft.client.Minecraft;
import net.minecraft.client.player.AbstractClientPlayer;
import net.minecraft.client.player.LocalPlayer;
import net.minecraft.network.chat.Component;
import net.minecraft.world.phys.Vec3;

import java.nio.file.Path;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import java.util.UUID;

public final class CamMode {

	// how quickly the view turns towards where it wants to look
	private static final double TURN_SPEED = 4;

	private static final List<Runnable> listeners = new ArrayList<>();

	private static CamConfig config;
	private static Path configFile;
	// static so it all survives a disconnect/reconnect
	private static boolean on;
	// the view set when camera mode turned on
	private static float centerYaw;
	private static float centerPitch;
	// where the camera actually points right now, eased towards the wanted view
	private static float yaw;
	private static float pitch;
	private static long panStart;
	private static long lastFrame;
	private static Director director;
	private static Director.Decision decision = new Director.Decision(Director.Action.PAN, null);

	private CamMode() {
	}

	public static void loadConfig() {
		configFile = FabricLoader.getInstance().getConfigDir().resolve("expansecam.json");
		config = CamConfig.load(configFile);
		director = new Director(config.crowdSize, config.idleSeconds);
	}

	public static CamConfig config() {
		return config;
	}

	public static boolean isOn() {
		return on;
	}

	public static float centerYaw() {
		return centerYaw;
	}

	public static void listen(Runnable onChange) {
		listeners.add(onChange);
	}

	public static void toggle(LocalPlayer player) {
		if (!on && player == null) {
			return;
		}
		on = !on;
		if (on) {
			centerYaw = player.getYRot();
			centerPitch = player.getXRot();
			yaw = centerYaw;
			pitch = centerPitch;
			restart();
		} else {
			showHud(Minecraft.getInstance());
		}
		// drop any clicks that piled up so nothing fires on the way out
		KeyMapping.releaseAll();
		ExpanseCam.LOGGER.info("Camera mode {}", on ? "on (" + config.shot().label() + ")" : "off");
		listeners.forEach(Runnable::run);
	}

	// Follow -> Pan -> Stationary, remembered in the config
	public static void cycleShot(LocalPlayer player) {
		config.mode = config.shot().next().name().toLowerCase(Locale.ROOT);
		config.save(configFile);
		restart();
		if (player != null) {
			// only shows in your own chat, nothing is sent to the server
			player.sendSystemMessage(Component.literal("Camera: " + config.shot().label()));
		}
		ExpanseCam.LOGGER.info("Camera shot {}", config.shot().label());
	}

	private static void restart() {
		director.reset();
		decision = new Director.Decision(Director.Action.PAN, null);
		panStart = System.nanoTime();
		lastFrame = 0;
	}

	public static void tick(Minecraft mc) {
		if (!on) {
			return;
		}
		// with BetterF1, F1 cycles visible -> no hud (hand still shows) -> all hidden
		for (int i = 0; i < 3 && !fullyHidden(mc); i++) {
			mc.gui.hud.toggle();
		}
		if (config.shot() == Shot.FOLLOW && mc.player != null && mc.level != null) {
			Director.Decision next = director.update(visiblePlayers(mc.player, mc.level.players()), System.nanoTime() / 1e9);
			if (next.action() == Director.Action.PAN && decision.action() != Director.Action.PAN) {
				// pan starts again from the set view, the view eases back there first
				panStart = System.nanoTime();
			}
			decision = next;
		}
	}

	private static List<Director.Seen> visiblePlayers(LocalPlayer self, List<AbstractClientPlayer> players) {
		List<Director.Seen> seen = new ArrayList<>();
		for (AbstractClientPlayer p : players) {
			if (p == self || p.isSpectator() || p.isInvisible()) {
				continue;
			}
			float dist = self.distanceTo(p);
			if (dist <= config.followRange && self.hasLineOfSight(p)) {
				seen.add(new Director.Seen(p.getUUID(), dist));
			}
		}
		return seen;
	}

	private static void showHud(Minecraft mc) {
		for (int i = 0; i < 3 && mc.gui.hud.isHidden(); i++) {
			mc.gui.hud.toggle();
		}
	}

	private static boolean fullyHidden(Minecraft mc) {
		Object state = BetterF1.state();
		return state != null ? "ALL_HIDDEN".equals(state.toString()) : mc.gui.hud.isHidden();
	}

	// called every frame so movement is smooth at 60 fps, not stepped at 20 tps
	public static void applyFrame(Minecraft mc) {
		LocalPlayer player = mc.player;
		if (!on || player == null) {
			return;
		}
		long now = System.nanoTime();
		double frame = lastFrame == 0 ? 0 : (now - lastFrame) / 1e9;
		lastFrame = now;

		float wantYaw = centerYaw;
		float wantPitch = centerPitch;
		switch (config.shot()) {
			case STATIONARY -> {
			}
			case PAN -> wantYaw = panYaw(now);
			case FOLLOW -> {
				switch (decision.action()) {
					case PAN -> wantYaw = panYaw(now);
					// lost them for a moment: stay looking where we were
					case HOLD -> {
						wantYaw = yaw;
						wantPitch = pitch;
					}
					case FOLLOW -> {
						AbstractClientPlayer target = find(mc, decision.target());
						if (target == null) {
							wantYaw = yaw;
							wantPitch = pitch;
						} else {
							float partial = mc.getDeltaTracker().getGameTimeDeltaPartialTick(true);
							Vec3 from = player.getEyePosition(partial);
							Vec3 to = target.getEyePosition(partial);
							double dx = to.x - from.x;
							double dz = to.z - from.z;
							wantYaw = Aim.yaw(dx, dz);
							wantPitch = Aim.pitch(to.y - from.y, Math.sqrt(dx * dx + dz * dz));
						}
					}
				}
			}
		}

		float amount = Aim.factor(frame, TURN_SPEED);
		yaw = Aim.approach(yaw, wantYaw, amount, false);
		pitch = Math.max(-90f, Math.min(90f, Aim.approach(pitch, wantPitch, amount, true)));

		player.setYRot(yaw);
		player.yRotO = yaw;
		player.yHeadRot = yaw;
		player.yHeadRotO = yaw;
		player.yBodyRot = yaw;
		player.yBodyRotO = yaw;
		player.setXRot(pitch);
		player.xRotO = pitch;
	}

	private static float panYaw(long now) {
		return Pan.yaw(centerYaw, config.swing, config.period, (now - panStart) / 1e9);
	}

	private static AbstractClientPlayer find(Minecraft mc, UUID id) {
		if (id == null || mc.level == null) {
			return null;
		}
		for (AbstractClientPlayer p : mc.level.players()) {
			if (p.getUUID().equals(id)) {
				return p;
			}
		}
		return null;
	}
}
