package com.lambda.expansecam;

import java.util.Locale;

// What the camera does while camera mode is on
public enum Shot {
	// look at the first player in sight, pan when nobody's there or it's a crowd
	FOLLOW,
	// swing back and forth around the set view
	PAN,
	// hold the set view
	STATIONARY;

	public Shot next() {
		return values()[(ordinal() + 1) % values().length];
	}

	public String label() {
		return name().charAt(0) + name().substring(1).toLowerCase(Locale.ROOT);
	}

	public static Shot parse(String name) {
		if (name != null) {
			for (Shot s : values()) {
				if (s.name().equalsIgnoreCase(name)) {
					return s;
				}
			}
		}
		return FOLLOW;
	}
}
