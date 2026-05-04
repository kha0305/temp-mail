const express = require('express');
const asyncHandler = require('../../middlewares/async-handler');
const providerManagerService = require('../../services/provider-manager.service');

const router = express.Router();

router.get(
  '/domains',
  asyncHandler(async (req, res) => {
    const requestedService = req.query.service || 'auto';
    const result = await providerManagerService.getAvailableDomains(requestedService);

    res.json({
      domains: result.domains,
      service: requestedService === 'auto' ? result.service : requestedService,
    });
  }),
);

module.exports = router;
