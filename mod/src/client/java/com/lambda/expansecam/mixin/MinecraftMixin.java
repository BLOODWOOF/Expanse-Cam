package com.lambda.expansecam.mixin;

import com.lambda.expansecam.CamMode;
import net.minecraft.client.Minecraft;
import org.spongepowered.asm.mixin.Mixin;
import org.spongepowered.asm.mixin.injection.At;
import org.spongepowered.asm.mixin.injection.Inject;
import org.spongepowered.asm.mixin.injection.callback.CallbackInfo;

@Mixin(Minecraft.class)
public class MinecraftMixin {

	// attack, use, hotbar, chat, F5 etc all go through here
	@Inject(method = "handleKeybinds", at = @At("HEAD"), cancellable = true)
	private void expansecam$noKeybinds(CallbackInfo ci) {
		if (CamMode.isOn()) {
			ci.cancel();
		}
	}
}
