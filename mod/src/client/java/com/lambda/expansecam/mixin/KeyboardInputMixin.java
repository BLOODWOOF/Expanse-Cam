package com.lambda.expansecam.mixin;

import com.lambda.expansecam.CamMode;
import net.minecraft.client.player.ClientInput;
import net.minecraft.client.player.KeyboardInput;
import net.minecraft.world.entity.player.Input;
import net.minecraft.world.phys.Vec2;
import org.spongepowered.asm.mixin.Mixin;
import org.spongepowered.asm.mixin.injection.At;
import org.spongepowered.asm.mixin.injection.Inject;
import org.spongepowered.asm.mixin.injection.callback.CallbackInfo;

// also stops shift from dismounting the cushion
@Mixin(KeyboardInput.class)
public abstract class KeyboardInputMixin extends ClientInput {

	@Inject(method = "tick", at = @At("TAIL"))
	private void expansecam$noMovement(CallbackInfo ci) {
		if (CamMode.isOn()) {
			this.keyPresses = Input.EMPTY;
			this.moveVector = Vec2.ZERO;
		}
	}
}
