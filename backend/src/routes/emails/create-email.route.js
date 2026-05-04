const express = require('express');
const asyncHandler = require('../../middlewares/async-handler');
const mailboxService = require('../../services/mailbox.service');

const router = express.Router();

router.post(
  '/emails/create',
  asyncHandler(async (req, res) => {
    const mailbox = await mailboxService.createMailbox(req.body || {});
    res.json(mailbox);
  }),
);

module.exports = router;
