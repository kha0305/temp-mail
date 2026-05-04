const express = require('express');
const asyncHandler = require('../../middlewares/async-handler');
const mailboxService = require('../../services/mailbox.service');

const router = express.Router();

router.get(
  '/emails/:id',
  asyncHandler(async (req, res) => {
    const mailbox = await mailboxService.getMailboxById(req.params.id);
    res.json(mailbox);
  }),
);

module.exports = router;
