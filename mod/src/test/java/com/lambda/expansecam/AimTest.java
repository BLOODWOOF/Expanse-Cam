package com.lambda.expansecam;

import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

class AimTest {

	// Minecraft yaw: 0 = south (+z), 90 = west (-x), 180 = north, -90 = east (+x)
	@Test
	void yawPointsAtTheTarget() {
		assertEquals(0f, Aim.yaw(0, 10), 1e-3);
		assertEquals(90f, Aim.yaw(-10, 0), 1e-3);
		assertEquals(-90f, Aim.yaw(10, 0), 1e-3);
		assertEquals(180f, Math.abs(Aim.yaw(0, -10)), 1e-3);
	}

	// pitch: negative = looking up
	@Test
	void pitchPointsAtTheTarget() {
		assertEquals(0f, Aim.pitch(0, 10), 1e-3);
		assertEquals(-45f, Aim.pitch(10, 10), 1e-3);
		assertEquals(45f, Aim.pitch(-10, 10), 1e-3);
	}

	@Test
	void turnsTheShortWayRound() {
		// from 170 to -170 is 20 degrees through 180, not 340 back the other way
		float step = Aim.approach(170f, -170f, 0.5f, false);
		assertEquals(180f, step, 1e-3);
		float back = Aim.approach(-170f, 170f, 0.5f, false);
		assertEquals(-180f, back, 1e-3);
	}

	@Test
	void approachMovesPartWayAndArrives() {
		assertEquals(50f, Aim.approach(0f, 100f, 0.5f, true), 1e-3);
		assertEquals(100f, Aim.approach(0f, 100f, 1f, true), 1e-3);
		assertEquals(0f, Aim.approach(0f, 100f, 0f, true), 1e-3);
	}

	@Test
	void pitchDoesNotWrap() {
		// pitch is a plain value between -90 and 90, no shortcut through 180
		assertEquals(0f, Aim.approach(-80f, 80f, 0.5f, true), 1e-3);
	}

	@Test
	void smoothingDependsOnFrameTimeNotFrameRate() {
		// two 30 fps frames land in the same place as one 15 fps frame
		float a = Aim.factor(1 / 30.0, 4);
		float twoSteps = Aim.approach(Aim.approach(0f, 100f, a, true), 100f, a, true);
		float oneStep = Aim.approach(0f, 100f, Aim.factor(1 / 15.0, 4), true);
		assertEquals(oneStep, twoSteps, 1e-3);
		assertTrue(Aim.factor(0, 4) == 0f);
	}
}
