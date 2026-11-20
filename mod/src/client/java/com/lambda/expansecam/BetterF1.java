package com.lambda.expansecam;

import net.fabricmc.loader.api.FabricLoader;

import java.lang.reflect.Field;

// Reads Better F1's HUD state if it's installed, without depending on it
final class BetterF1 {

	private static Field stateField;
	private static boolean looked;

	private BetterF1() {
	}

	static Object state() {
		if (!looked) {
			looked = true;
			if (FabricLoader.getInstance().isModLoaded("betterf1")) {
				try {
					stateField = Class.forName("com.movtery.betterf1.BetterF1").getField("state");
				} catch (ReflectiveOperationException e) {
					ExpanseCam.LOGGER.warn("Better F1 is loaded but its state couldn't be read", e);
				}
			}
		}
		if (stateField == null) {
			return null;
		}
		try {
			return stateField.get(null);
		} catch (IllegalAccessException e) {
			return null;
		}
	}
}
