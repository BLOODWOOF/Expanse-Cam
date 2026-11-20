package com.lambda.expansecam;

public final class Pan {

	private Pan() {
	}

	// Sine swing around center, starting from the middle. t is seconds since camera mode went on.
	public static float yaw(float center, float swing, float periodSec, double tSec) {
		return center + swing * (float) Math.sin(2 * Math.PI * tSec / periodSec);
	}

	// Never let it reach 180 either side, that would be a full circle
	public static float clampSwing(float swing) {
		return Math.max(0f, Math.min(179f, swing));
	}
}
