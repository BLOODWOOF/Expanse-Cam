package com.lambda.expansecam;

import com.google.gson.JsonObject;
import com.google.gson.JsonParser;
import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.*;

class CameraStateTest {

	@Test
	void writesAllKeys() {
		var s = new CameraState(true, "minecraft:overworld", 120, 210, -340, 90f, 45f, 1700000000000L);
		JsonObject o = JsonParser.parseString(s.toJson()).getAsJsonObject();
		assertTrue(o.get("online").getAsBoolean());
		assertEquals("minecraft:overworld", o.get("dimension").getAsString());
		assertEquals(120, o.get("x").getAsInt());
		assertEquals(210, o.get("y").getAsInt());
		assertEquals(-340, o.get("z").getAsInt());
		assertEquals(90f, o.get("yaw").getAsFloat());
		assertEquals(45f, o.get("swing").getAsFloat());
		assertEquals(1700000000000L, o.get("updated").getAsLong());
	}

	@Test
	void offlineKeepsLastSpot() {
		var s = new CameraState(true, "minecraft:overworld", 1, 2, 3, 0f, 45f, 5L).offline(9L);
		assertFalse(s.online());
		assertEquals(3, s.z());
		assertEquals(9L, s.updated());
	}
}
