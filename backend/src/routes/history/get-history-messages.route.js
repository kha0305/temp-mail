const express = require('express');
const asyncHandler = require('../../middlewares/async-handler');
const historyService = require('../../services/history.service');

const router = express.Router();

router.get(
  '/emails/history/:id/messages',
  asyncHandler(async (req, res) => {
    const result = await historyService.listHistoryMessages(req.params.id);
    res.json(result);
  }),
);

module.exports = router;
