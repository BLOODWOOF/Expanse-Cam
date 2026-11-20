package com.lambda.expansecam.mixin;

import com.lambda.expansecam.CamMode;
import net.minecraft.client.MouseHandler;
import org.spongepowered.asm.mixin.Mixin;
import org.spongepowered.asm.mixin.injection.At;
import org.spongepowered.asm.mixin.injection.Inject;
import org.spongepowered.asm.mixin.injection.callback.CallbackInfo;

@Mixin(MouseHandler.class)
public class MouseHandlerMixin {

	@Inject(method = "turnPlayer", at = @At("HEAD"), cancellable = true)
	private void expansecam$noMouseLook(double delta, CallbackInfo ci) {
		if (CamMode.isOn()) {
			ci.cancel();
		}
	}
}
