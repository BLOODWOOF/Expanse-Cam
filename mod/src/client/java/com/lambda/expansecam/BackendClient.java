package com.lambda.expansecam;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;

// Talks to the local backend. Never blocks or throws on the game thread.
final class BackendClient {

	private static final HttpClient HTTP = HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(1)).build();

	private BackendClient() {
	}

	static void post(String path, String json) {
		HttpRequest req = HttpRequest.newBuilder(URI.create(CamMode.config().backend + path))
				.timeout(Duration.ofSeconds(2))
				.header("content-type", "application/json")
				.POST(HttpRequest.BodyPublishers.ofString(json))
				.build();
		HTTP.sendAsync(req, HttpResponse.BodyHandlers.discarding())
				.exceptionally(e -> null);
	}

	// blocking, only call off the game thread
	static boolean alive() {
		try {
			HttpRequest req = HttpRequest.newBuilder(URI.create(CamMode.config().backend + "/"))
					.timeout(Duration.ofSeconds(1))
					.GET()
					.build();
			return HTTP.send(req, HttpResponse.BodyHandlers.discarding()).statusCode() == 200;
		} catch (Exception e) {
			return false;
		}
	}
}
