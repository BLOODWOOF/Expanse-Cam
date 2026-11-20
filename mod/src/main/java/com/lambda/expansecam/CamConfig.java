package com.lambda.expansecam;

import com.google.gson.Gson;
import com.google.gson.GsonBuilder;
import com.google.gson.JsonParseException;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;

public class CamConfig {

	private static final Gson GSON = new GsonBuilder().setPrettyPrinting().create();

	// degrees each side of center
	public float swing = 45;
	// seconds for one full back-and-forth
	public float period = 120;
	// streaming only starts/stops on this account
	public String account = "CHUDWOLF";
	// folder with start.ps1 / stop.ps1, empty = don't run them
	public String projectDir = "";
	// how long after leaving the server before stop.ps1 runs
	public int stopDelayMinutes = 6;
	public String backend = "http://127.0.0.1:8081";
	// follow, pan or stationary; the cycle key changes it
	public String mode = "follow";
	// blocks
	public int followRange = 24;
	// this many players in sight at once = pan instead of following
	public int crowdSize = 5;
	// how long nobody's in sight before going back to panning
	public float idleSeconds = 5;

	public Shot shot() {
		return Shot.parse(mode);
	}

	public static CamConfig load(Path file) {
		CamConfig cfg = null;
		if (Files.exists(file)) {
			try {
				cfg = GSON.fromJson(Files.readString(file), CamConfig.class);
			} catch (IOException | JsonParseException e) {
				ExpanseCam.LOGGER.warn("Couldn't read {}, using defaults", file, e);
			}
		}
		if (cfg == null) {
			cfg = new CamConfig();
		}
		cfg.swing = Pan.clampSwing(cfg.swing);
		cfg.period = Math.max(10f, cfg.period);
		cfg.stopDelayMinutes = Math.max(1, cfg.stopDelayMinutes);
		cfg.mode = cfg.shot().name().toLowerCase(java.util.Locale.ROOT);
		cfg.followRange = Math.max(4, Math.min(64, cfg.followRange));
		cfg.crowdSize = Math.max(2, cfg.crowdSize);
		cfg.idleSeconds = Math.max(1f, cfg.idleSeconds);
		if (cfg.account == null) {
			cfg.account = "CHUDWOLF";
		}
		if (cfg.projectDir == null) {
			cfg.projectDir = "";
		}
		if (cfg.backend == null || cfg.backend.isBlank()) {
			cfg.backend = "http://127.0.0.1:8081";
		}
		cfg.save(file);
		return cfg;
	}

	public void save(Path file) {
		try {
			Files.createDirectories(file.getParent());
			Files.writeString(file, GSON.toJson(this));
		} catch (IOException e) {
			ExpanseCam.LOGGER.warn("Couldn't save {}", file, e);
		}
	}
}
