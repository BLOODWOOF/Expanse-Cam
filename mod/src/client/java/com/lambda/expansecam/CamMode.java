package com.lambda.expansecam;

import net.fabricmc.loader.api.FabricLoader;
import net.minecraft.client.KeyMapping;
import net.minecraft.client.Minecraft;
import net.minecraft.client.player.LocalPlayer;

import java.util.ArrayList;
import java.util.List;

public final class CamMode {

	private static final List<Runnable> listeners = new ArrayList<>();

	private static CamConfig config;
	// static so it all survives a disconnect/reconnect
	private static boolean on;
	private static float centerYaw;
	private static long startNanos;

	private CamMode() {
	}

	public static void loadConfig() {
		config = CamConfig.load(FabricLoader.getInstance().getConfigDir().resolve("expansecam.json"));
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
			startNanos = System.nanoTime();
		} else {
			showHud(Minecraft.getInstance());
		}
		// drop any clicks that piled up so nothing fires on the way out
		KeyMapping.releaseAll();
		ExpanseCam.LOGGER.info("Camera mode {}", on ? "on" : "off");
		listeners.forEach(Runnable::run);
	}

	public static void tick(Minecraft mc) {
		if (on) {
			// with BetterF1, F1 cycles visible -> no hud (hand still shows) -> all hidden
			for (int i = 0; i < 3 && !fullyHidden(mc); i++) {
				mc.gui.hud.toggle();
			}
		}
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

	// called every frame so the swing is smooth at 60 fps, not stepped at 20 tps
	public static void applyFrame(Minecraft mc) {
		LocalPlayer player = mc.player;
		if (!on || player == null) {
			return;
		}
		double t = (System.nanoTime() - startNanos) / 1e9;
		float yaw = Pan.yaw(centerYaw, config.swing, config.period, t);
		player.setYRot(yaw);
		player.yRotO = yaw;
		player.yHeadRot = yaw;
		player.yHeadRotO = yaw;
		player.yBodyRot = yaw;
		player.yBodyRotO = yaw;
	}
}
