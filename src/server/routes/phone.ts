import { Hono } from 'hono'
import { getPhoneNumbersConfig } from '../configuration.ts'

export const phoneRouter = new Hono()

phoneRouter.get('/:phoneNumberId', (c) => {
	const phoneNumberId = c.req.param('phoneNumberId')
	const phoneNumbersConfig = getPhoneNumbersConfig()

	if (!phoneNumbersConfig || !phoneNumbersConfig[phoneNumberId]) {
		console.warn(
			`Phone number ID '${phoneNumberId}' not found in configuration. Please add it to whap.json under 'phoneNumbers'.`
		)
		return c.json(
			{
				error: {
					message: `Phone number ID '${phoneNumberId}' not configured`,
					type: 'phone_number_not_found',
					code: 500,
				},
			},
			500
		)
	}

	const phoneInfo = phoneNumbersConfig[phoneNumberId]
	return c.json({
		display_phone_number: phoneInfo.displayPhoneNumber,
	})
})
