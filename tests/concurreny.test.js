// testEvents.js
const axios = require("axios");

const BASE_URL = "http://localhost:3000/api/events"; // your POST API

// 10 unique events + 2 duplicates
const events = [
    { userId: "user1", eventId: "event1", bookingId: "booking1", seats: 2 },
    { userId: "user2", eventId: "event1", bookingId: "booking2", seats: 2 },
    { userId: "user3", eventId: "event1", bookingId: "booking3", seats: 2 },
    { userId: "user4", eventId: "event1", bookingId: "booking4", seats: 2 },
    { userId: "user5", eventId: "event1", bookingId: "booking5", seats: 2 },
    { userId: "user6", eventId: "event1", bookingId: "booking6", seats: 2 },
    { userId: "user7", eventId: "event1", bookingId: "booking7", seats: 2 },
    { userId: "user8", eventId: "event1", bookingId: "booking8", seats: 2 },
    { userId: "user9", eventId: "event1", bookingId: "booking9", seats: 2 },
    { userId: "user10", eventId: "event1", bookingId: "booking10", seats: 2 },
    { userId: "user10", eventId: "event1", bookingId: "booking10", seats: 2 },
];

// add duplicates for testing idempotency
events.push(events[0], events[3]);

// function to send a POST request
const sendEvent = async (e) => {
    try {
        const idempotencyKey = `idemp-${e.bookingId}`; // same for duplicates
        const res = await axios.post(BASE_URL, e);
        console.log(`Sent event ${e.bookingId}:`, res.data);
    } catch (err) {
        console.error(`Error sending ${e.bookingId}:`, err.message);
    }
};

// send all events concurrently
(async () => {
    await Promise.all(events.map(sendEvent));
    console.log("All test events sent");
})();
