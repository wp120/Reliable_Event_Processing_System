const createEvent = (req, res) => {
  console.log("POST request received");
  console.log("Request body:", req.body);
  
  res.status(200).json({ 
    message: "Event received successfully",
    data: req.body 
  });
};

module.exports = {
  createEvent
};
