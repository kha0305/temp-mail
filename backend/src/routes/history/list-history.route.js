const express = require('express');
const asyncHandler = require('../../middlewares/async-handler');
const historyService = require('../../services/history.service');

const router = express.Router();

router.get(
  '/emails/history/list',
  asyncHandler(async (req, res) => {
    const history = await historyService.listHistory();
    res.json(history);
  }),
);

module.exports = router;
