package com.lambda.expansecam;

import com.google.gson.JsonObject;
import net.fabricmc.fabric.api.client.event.lifecycle.v1.ClientLifecycleEvents;
import net.fabricmc.fabric.api.client.event.lifecycle.v1.ClientTickEvents;
import net.fabricmc.fabric.api.client.message.v1.ClientReceiveMessageEvents;
import net.fabricmc.fabric.api.client.networking.v1.ClientPlayConnectionEvents;
import net.minecraft.client.Minecraft;
import net.minecraft.client.player.LocalPlayer;

import java.io.File;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.concurrent.Executors;
import java.util.concurrent.ScheduledExecutorService;
import java.util.concurrent.ScheduledFuture;
import java.util.concurrent.TimeUnit;

// Starts, pauses and stops the stream with camera mode, only on the cam account
final class Session {

	private static final int REFRESH_TICKS = 600;

	private static final ScheduledExecutorService worker = Executors.newSingleThreadScheduledExecutor(r -> {
		Thread t = new Thread(r, "expansecam-session");
		t.setDaemon(true);
		return t;
	});

	// set once start.ps1 has been run this game session, so stop.ps1 only runs if we started things
	private static boolean started;
	private static ScheduledFuture<?> pendingStop;
	private static int ticks;

	private Session() {
	}

	static void register() {
		CamMode.listen(() -> onToggle(Minecraft.getInstance()));

		ClientTickEvents.END_CLIENT_TICK.register(mc -> {
			if (CamMode.isOn() && isOwnAccount(mc) && mc.player != null && ++ticks >= REFRESH_TICKS) {
				ticks = 0;
				sendCamera(mc);
			}
		});

		ClientPlayConnectionEvents.JOIN.register((handler, sender, mc) -> {
			ticks = 0;
			cancelStop();
			mc.execute(() -> {
				if (CamMode.isOn() && isOwnAccount(mc)) {
					sendCamera(mc);
				}
			});
		});

		ClientPlayConnectionEvents.DISCONNECT.register((handler, mc) -> {
			if (!started) {
				return;
			}
			// pause right away, stop everything if we don't come back
			BackendClient.post("/mod/camera", "{\"online\":false}");
			cancelStop();
			int minutes = CamMode.config().stopDelayMinutes;
			pendingStop = worker.schedule(() -> runScript("stop.ps1"), minutes, TimeUnit.MINUTES);
			ExpanseCam.LOGGER.info("Left the server, stopping the stream in {} min unless we rejoin", minutes);
		});

		ClientLifecycleEvents.CLIENT_STOPPING.register(mc -> {
			if (started) {
				cancelStop();
				runScript("stop.ps1");
			}
		});

		ClientReceiveMessageEvents.CHAT.register((message, signed, sender, params, time) -> {
			String type = params.chatType().unwrapKey().map(k -> k.identifier().toString()).orElse("");
			if (ChatFilter.keepChat(type)) {
				sendChat(message.getString(), "chat");
			}
		});
		ClientReceiveMessageEvents.GAME.register((message, overlay) -> {
			String text = message.getString();
			if (ChatFilter.keepGame(text, overlay)) {
				sendChat(text, "game");
			}
		});
	}

	static boolean isOwnAccount(Minecraft mc) {
		return mc.getUser().getName().equalsIgnoreCase(CamMode.config().account);
	}

	private static void onToggle(Minecraft mc) {
		if (!isOwnAccount(mc)) {
			return;
		}
		if (CamMode.isOn()) {
			cancelStop();
			worker.execute(() -> {
				// every time, not just when the backend is down: start.ps1 skips whatever's
				// already running, and it's also what moves the public link off the maintenance page
				runScript("start.ps1");
				started = true;
				waitForBackend();
				mc.execute(() -> sendCamera(mc));
			});
		} else {
			sendCamera(mc);
		}
	}

	private static void waitForBackend() {
		for (int i = 0; i < 40 && !BackendClient.alive(); i++) {
			try {
				Thread.sleep(500);
			} catch (InterruptedException e) {
				return;
			}
		}
	}

	private static void sendCamera(Minecraft mc) {
		LocalPlayer player = mc.player;
		if (!CamMode.isOn() || player == null || mc.level == null) {
			BackendClient.post("/mod/camera", "{\"online\":false}");
			return;
		}
		CameraState state = new CameraState(true, mc.level.dimension().identifier().toString(),
				player.getBlockX(), player.getBlockY(), player.getBlockZ(),
				CamMode.centerYaw(), CamMode.config().swing, System.currentTimeMillis());
		BackendClient.post("/mod/camera", state.toJson());
	}

	private static void sendChat(String text, String kind) {
		Minecraft mc = Minecraft.getInstance();
		if (!CamMode.isOn() || !isOwnAccount(mc) || text.isBlank()) {
			return;
		}
		JsonObject o = new JsonObject();
		o.addProperty("text", text);
		o.addProperty("kind", kind);
		BackendClient.post("/mod/chat", o.toString());
	}

	private static void cancelStop() {
		if (pendingStop != null) {
			pendingStop.cancel(false);
			pendingStop = null;
		}
	}

	private static void runScript(String name) {
		String dir = CamMode.config().projectDir;
		if (dir.isBlank()) {
			ExpanseCam.LOGGER.warn("projectDir isn't set in expansecam.json, not running {}", name);
			return;
		}
		Path script = Path.of(dir, name);
		if (!Files.exists(script)) {
			ExpanseCam.LOGGER.warn("{} doesn't exist", script);
			return;
		}
		try {
			new ProcessBuilder("powershell.exe", "-NoProfile", "-ExecutionPolicy", "Bypass",
					"-WindowStyle", "Hidden", "-File", script.toString())
					.directory(new File(dir))
					.redirectErrorStream(true)
					.redirectOutput(ProcessBuilder.Redirect.DISCARD)
					.start();
			ExpanseCam.LOGGER.info("Ran {}", name);
		} catch (Exception e) {
			ExpanseCam.LOGGER.warn("Couldn't run {}", script, e);
		}
	}
}
