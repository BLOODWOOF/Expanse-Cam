package com.lambda.expansecam;

import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertEquals;

class PanTest {

	@Test
	void startsAtCenter() {
		assertEquals(90f, Pan.yaw(90, 45, 120, 0), 1e-4);
	}

	@Test
	void swingsBothWays() {
		assertEquals(135f, Pan.yaw(90, 45, 120, 30), 1e-3);
		assertEquals(45f, Pan.yaw(90, 45, 120, 90), 1e-3);
		assertEquals(90f, Pan.yaw(90, 45, 120, 120), 1e-3);
	}

	@Test
	void swingIsClamped() {
		assertEquals(179f, Pan.clampSwing(400));
		assertEquals(0f, Pan.clampSwing(-5));
		assertEquals(45f, Pan.clampSwing(45));
	}
}
