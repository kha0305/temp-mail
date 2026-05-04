const express = require('express');
const asyncHandler = require('../../middlewares/async-handler');
const messageService = require('../../services/message.service');

const router = express.Router();

router.post(
  '/emails/:id/messages/:messageId/save',
  asyncHandler(async (req, res) => {
    const result = await messageService.saveMailboxMessage(req.params.id, req.params.messageId);
    res.json(result);
  }),
);

module.exports = router;
