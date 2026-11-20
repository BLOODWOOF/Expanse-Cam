package com.lambda.expansecam;

import com.mojang.blaze3d.platform.InputConstants;
import net.fabricmc.api.ClientModInitializer;
import net.fabricmc.fabric.api.client.event.lifecycle.v1.ClientTickEvents;
import net.fabricmc.fabric.api.client.keymapping.v1.KeyMappingHelper;
import net.minecraft.client.KeyMapping;
import net.minecraft.resources.Identifier;

public class ExpanseCamClient implements ClientModInitializer {

	private static final KeyMapping.Category CATEGORY = KeyMapping.Category.register(
			Identifier.fromNamespaceAndPath(ExpanseCam.MOD_ID, "general")
	);

	public static KeyMapping toggleKey;
	public static KeyMapping shotKey;

	@Override
	public void onInitializeClient() {
		CamMode.loadConfig();
		Session.register();

		// unbound by default, same "unknown" value nopause uses
		toggleKey = KeyMappingHelper.registerKeyMapping(new KeyMapping(
				"key.expansecam.toggle",
				InputConstants.Type.KEYBOARD,
				InputConstants.UNKNOWN.getValue(),
				CATEGORY
		));

		// Follow -> Pan -> Stationary, works with camera mode on or off
		shotKey = KeyMappingHelper.registerKeyMapping(new KeyMapping(
				"key.expansecam.shot",
				InputConstants.Type.KEYBOARD,
				InputConstants.UNKNOWN.getValue(),
				CATEGORY
		));

		ClientTickEvents.END_CLIENT_TICK.register(mc -> {
			while (toggleKey.consumeClick()) {
				CamMode.toggle(mc.player);
			}
			while (shotKey.consumeClick()) {
				CamMode.cycleShot(mc.player);
			}
			CamMode.tick(mc);
		});
	}
}
