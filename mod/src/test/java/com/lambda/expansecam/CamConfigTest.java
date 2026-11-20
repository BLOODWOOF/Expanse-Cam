package com.lambda.expansecam;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;

import java.nio.file.Files;
import java.nio.file.Path;

import static org.junit.jupiter.api.Assertions.*;

class CamConfigTest {

	@TempDir
	Path dir;

	@Test
	void missingFileWritesDefaults() throws Exception {
		Path file = dir.resolve("expansecam.json");
		CamConfig cfg = CamConfig.load(file);
		assertEquals(45f, cfg.swing);
		assertEquals(120f, cfg.period);
		assertEquals("CHUDWOLF", cfg.account);
		assertEquals(6, cfg.stopDelayMinutes);
		assertEquals("http://127.0.0.1:8081", cfg.backend);
		assertEquals("", cfg.projectDir);
		assertTrue(Files.exists(file));
	}

	@Test
	void stopDelayIsAtLeastAMinute() throws Exception {
		Path file = dir.resolve("expansecam.json");
		Files.writeString(file, "{\"stopDelayMinutes\":0}");
		assertEquals(1, CamConfig.load(file).stopDelayMinutes);
	}

	@Test
	void badValuesGetClamped() throws Exception {
		Path file = dir.resolve("expansecam.json");
		Files.writeString(file, "{\"swing\":300,\"period\":2}");
		CamConfig cfg = CamConfig.load(file);
		assertEquals(179f, cfg.swing);
		assertEquals(10f, cfg.period);
	}

	@Test
	void brokenFileFallsBackToDefaults() throws Exception {
		Path file = dir.resolve("expansecam.json");
		Files.writeString(file, "{not json");
		CamConfig cfg = CamConfig.load(file);
		assertEquals(45f, cfg.swing);
	}
}
