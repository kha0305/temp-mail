const express = require('express');
const asyncHandler = require('../../middlewares/async-handler');
const historyService = require('../../services/history.service');

const router = express.Router();

router.get(
  '/emails/history/:id/messages/:messageId',
  asyncHandler(async (req, res) => {
    const result = await historyService.getHistoryMessageDetail(req.params.id, req.params.messageId);
    res.json(result);
  }),
);

module.exports = router;
