const express = require('express');
const asyncHandler = require('../../middlewares/async-handler');
const messageService = require('../../services/message.service');

const router = express.Router();

router.get(
  '/emails/:id/messages/:messageId',
  asyncHandler(async (req, res) => {
    const message = await messageService.getMailboxMessageDetail(req.params.id, req.params.messageId);
    res.json(message);
  }),
);

module.exports = router;
