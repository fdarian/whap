import { formatDistanceToNow } from 'date-fns'
import { Box, Text } from 'ink'
import { type FC, useEffect, useState } from 'react'
import type { ApiClient } from '../utils/api-client.ts'
import { webSocketClient } from '../utils/websocket-client.ts'

interface StatusBarProps {
	apiClient: ApiClient
}

interface StatsUpdatePayload {
	totalMessages: number
	uptime: number
	lastActivity: string | null
}

function isStatsUpdatePayload(payload: unknown): payload is StatsUpdatePayload {
	return (
		typeof payload === 'object' &&
		payload !== null &&
		'totalMessages' in payload &&
		'uptime' in payload &&
		'lastActivity' in payload
	)
}

export const StatusBar: FC<StatusBarProps> = ({ apiClient }) => {
	const [stats, setStats] = useState<{
		totalMessages: number
		uptime: number
		lastActivity: Date | null
	} | null>(null)

	useEffect(() => {
		const fetchStats = async () => {
			try {
				const statsData = await apiClient.getStats()
				setStats(statsData)
			} catch (error) {
				// Silently fail - stats are not critical
			}
		}

		fetchStats()

		const handleWebSocketMessage = (message: {
			type: string
			payload: unknown
		}) => {
			if (
				message.type === 'STATS_UPDATE' &&
				isStatsUpdatePayload(message.payload)
			) {
				// The payload from the server should match the stats object structure
				setStats({
					...message.payload,
					lastActivity: message.payload.lastActivity
						? new Date(message.payload.lastActivity)
						: null,
				})
			}
		}

		webSocketClient.addMessageListener(handleWebSocketMessage)

		return () => {
			webSocketClient.removeMessageListener(handleWebSocketMessage)
		}
	}, [apiClient])

	const formatUptime = (seconds: number) => {
		const hours = Math.floor(seconds / 3600)
		const minutes = Math.floor((seconds % 3600) / 60)
		const secs = seconds % 60

		if (hours > 0) {
			return `${hours}h ${minutes}m`
		}
		if (minutes > 0) {
			return `${minutes}m ${secs}s`
		}
		return `${secs}s`
	}

	return (
		<Box paddingX={3} paddingY={1} borderStyle="single" borderColor="gray">
			<Box gap={6}>
				<Text color="gray" dimColor>
					Messages: {stats?.totalMessages ?? 0}
				</Text>
				<Text color="gray" dimColor>
					Uptime: {stats ? formatUptime(stats.uptime) : '0s'}
				</Text>
				{stats?.lastActivity && (
					<Text color="gray" dimColor>
						Last Activity:{' '}
						{formatDistanceToNow(stats.lastActivity, { addSuffix: true })}
					</Text>
				)}
			</Box>
		</Box>
	)
}
