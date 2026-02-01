const axios = require("axios");

const API_URL = "http://localhost:3000/api/events";

async function testDeadLetter() {

    try {
        console.log("Sending event that will always fail...");

        await axios.post(API_URL, {
            bookingId: "booking-dead-1",
            userId: "user-1",
            eventId: "event-1",
            seats: 1,
            forcedFail: true, // consumer will throw
        });

        console.log("Event sent. Now wait and observe retries...");
        console.log("Expected:");
        console.log("- retryCount increments");
        console.log("- exponential backoff delays");
        console.log("- after max retries → status = DEAD");
        console.log("- message ACKed and stops retrying");
    } catch (error) {
        console.log("Error in testDeadLetter: ", error);
    }
}

testDeadLetter();
