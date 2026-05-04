const express = require('express');
const asyncHandler = require('../../middlewares/async-handler');
const mailboxService = require('../../services/mailbox.service');

const router = express.Router();

router.get(
  '/emails',
  asyncHandler(async (req, res) => {
    const mailboxes = await mailboxService.listMailboxes();
    res.json(mailboxes);
  }),
);

module.exports = router;
