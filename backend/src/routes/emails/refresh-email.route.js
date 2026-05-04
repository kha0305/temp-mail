const express = require('express');
const asyncHandler = require('../../middlewares/async-handler');
const messageService = require('../../services/message.service');

const router = express.Router();

router.post(
  '/emails/:id/refresh',
  asyncHandler(async (req, res) => {
    const result = await messageService.getMailboxMessages(req.params.id);
    res.json(result);
  }),
);

module.exports = router;
