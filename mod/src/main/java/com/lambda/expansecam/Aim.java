package com.lambda.expansecam;

// Angles for looking at things, in Minecraft's terms:
// yaw 0 = south (+z), 90 = west (-x); pitch negative = looking up.
public final class Aim {

	private Aim() {
	}

	public static float yaw(double dx, double dz) {
		return (float) Math.toDegrees(Math.atan2(-dx, dz));
	}

	public static float pitch(double dy, double horizontal) {
		return (float) -Math.toDegrees(Math.atan2(dy, horizontal));
	}

	// Moves `amount` (0..1) of the way from current to target. Yaw goes the short way round
	// through 180; pitch (plain = true) is just a number.
	public static float approach(float current, float target, float amount, boolean plain) {
		float delta = target - current;
		if (!plain) {
			delta = ((delta + 180f) % 360f + 360f) % 360f - 180f;
		}
		return current + delta * amount;
	}

	// How far to move this frame so turning takes the same time at 30 or 144 fps
	public static float factor(double frameSeconds, double speed) {
		return (float) (1 - Math.exp(-frameSeconds * speed));
	}
}
