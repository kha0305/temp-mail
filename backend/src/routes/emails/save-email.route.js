const express = require('express');
const asyncHandler = require('../../middlewares/async-handler');
const mailboxService = require('../../services/mailbox.service');

const router = express.Router();

router.post(
  '/emails/:id/save',
  asyncHandler(async (req, res) => {
    const { record } = await mailboxService.saveMailbox(req.params.id);
    res.json(record);
  }),
);

module.exports = router;
