import { format } from "date-fns";
import { Box, Text, useInput } from "ink";
import { type FC, useCallback, useEffect, useState } from "react";
import type { ApiClient, Message, Template } from "../utils/api-client.ts";
import { useTerminal } from "../utils/terminal.ts";
import { webSocketClient } from "../utils/websocket-client.ts";
import { TextInput } from "./TextInput.tsx";

interface SimplifiedChatInterfaceProps {
	apiClient: ApiClient;
	userPhoneNumber: string;
	botPhoneNumber: string;
	onNewConversation: () => void;
}

type InterfaceMode = "chat" | "templates" | "template-params";

export const SimplifiedChatInterface: FC<SimplifiedChatInterfaceProps> = ({
	apiClient,
	userPhoneNumber,
	botPhoneNumber,
	onNewConversation,
}) => {
	const [messages, setMessages] = useState<Message[]>([]);
	const [loading, setLoading] = useState(false);
	const [error, setError] = useState<string>("");
	const [currentMessage, setCurrentMessage] = useState("");
	const [status, setStatus] = useState<"idle" | "sending" | "sent" | "error">(
		"idle",
	);
	const [errorMessage, setErrorMessage] = useState("");
	const [isAgentTyping, setIsAgentTyping] = useState(false);

	// Template-related state
	const [mode, setMode] = useState<InterfaceMode>("chat");
	const [templates, setTemplates] = useState<Template[]>([]);
	const [selectedTemplateIndex, setSelectedTemplateIndex] = useState(0);
	const [selectedTemplate, setSelectedTemplate] = useState<Template | null>(
		null,
	);
	const [templateParams, setTemplateParams] = useState<Record<string, string>>(
		{},
	);
	const [currentParamKey, setCurrentParamKey] = useState<string>("");
	const [currentParamValue, setCurrentParamValue] = useState("");
	const [templatesLoading, setTemplatesLoading] = useState(false);

	const terminal = useTerminal();

	// Calculate max messages based on available space - conservative approach
	const calculateMaxMessages = useCallback(() => {
		// Reserve space for header (3 lines) + input area (4 lines) + margins
		const availableLines = Math.max(5, terminal.rows - 10);
		// Each message takes roughly 2-3 lines, so divide by 3 for safety
		return Math.max(3, Math.floor(availableLines / 3));
	}, [terminal.rows]);

	const loadConversation = useCallback(async () => {
		setLoading(true);
		setError("");

		try {
			const history = await apiClient.getConversationHistory(
				userPhoneNumber,
				botPhoneNumber,
			);
			setMessages(history.messages);
		} catch (err) {
			setError(
				err instanceof Error ? err.message : "Failed to load conversation",
			);
		} finally {
			setLoading(false);
		}
	}, [apiClient, userPhoneNumber, botPhoneNumber]);

	useEffect(() => {
		loadConversation();

		const handleWebSocketMessage = (message: {
			type: string;
			payload: unknown;
		}) => {
			if (message.type === "NEW_MESSAGE") {
				loadConversation();
				setIsAgentTyping(false);
			} else if (message.type === "TYPING_INDICATOR") {
				const payload = message.payload as {
					phoneNumberId: string;
					messageId: string;
					isTyping: boolean;
					timestamp: number;
				};
				// Show typing indicator when the agent (bot) is typing to the user
				if (payload.phoneNumberId === botPhoneNumber) {
					setIsAgentTyping(payload.isTyping);
				}
			}
		};

		webSocketClient.addMessageListener(handleWebSocketMessage);

		return () => {
			webSocketClient.removeMessageListener(handleWebSocketMessage);
		};
	}, [loadConversation, botPhoneNumber]);

	useInput((input, key) => {
		if (mode === "chat") {
			if (key.return && currentMessage.trim()) {
				void handleSendMessage(); // fire-and-forget
				return;
			}

			if (key.ctrl && input === "r") {
				loadConversation();
			}

			if (key.ctrl && input === "n") {
				onNewConversation();
			}

			if (key.ctrl && input === "t") {
				void handleTemplateMode();
			}
		} else if (mode === "templates") {
			if (key.upArrow && selectedTemplateIndex > 0) {
				setSelectedTemplateIndex(selectedTemplateIndex - 1);
			}

			if (key.downArrow && selectedTemplateIndex < templates.length - 1) {
				setSelectedTemplateIndex(selectedTemplateIndex + 1);
			}

			if (key.return && templates[selectedTemplateIndex]) {
				handleSelectTemplate(templates[selectedTemplateIndex]);
			}

			if (key.escape) {
				setMode("chat");
			}
		} else if (mode === "template-params") {
			if (key.return && currentParamValue.trim()) {
				handleSetTemplateParam();
			}

			if (key.escape) {
				setMode("templates");
			}

			if (key.ctrl && input === "s") {
				void handleSendTemplateMessage();
			}
		}
	});

	const handleTemplateMode = async () => {
		setMode("templates");
		setTemplatesLoading(true);
		try {
			const fetchedTemplates = await apiClient.getTemplates();
			setTemplates(fetchedTemplates);
			setSelectedTemplateIndex(0);
		} catch (error) {
			setError("Failed to load templates");
		} finally {
			setTemplatesLoading(false);
		}
	};

	const handleSelectTemplate = (template: Template) => {
		setSelectedTemplate(template);
		setTemplateParams({});

		if (template.variables && Object.keys(template.variables).length > 0) {
			// Template has parameters, switch to parameter input mode
			const firstParamKey = Object.keys(template.variables)[0];
			setCurrentParamKey(firstParamKey);
			setCurrentParamValue("");
			setMode("template-params");
		} else {
			// No parameters needed, send immediately
			void handleSendTemplateMessage();
		}
	};

	const handleSetTemplateParam = () => {
		if (!currentParamKey || !currentParamValue.trim() || !selectedTemplate)
			return;

		const newParams = {
			...templateParams,
			[currentParamKey]: currentParamValue,
		};
		setTemplateParams(newParams);
		setCurrentParamValue("");

		// Move to next parameter if available
		const paramKeys = Object.keys(selectedTemplate.variables || {});
		const currentIndex = paramKeys.indexOf(currentParamKey);

		if (currentIndex < paramKeys.length - 1) {
			// More parameters to fill
			setCurrentParamKey(paramKeys[currentIndex + 1]);
		} else {
			// All parameters filled, ready to send
			setCurrentParamKey("");
		}
	};

	const handleSendTemplateMessage = async () => {
		if (!selectedTemplate) return;

		setStatus("sending");
		setErrorMessage("");

		try {
			// Convert templateParams to parameter array
			const paramValues = Object.keys(selectedTemplate.variables || {})
				.sort()
				.map((key) => templateParams[key] || "");

			await apiClient.sendTemplateMessage(
				userPhoneNumber,
				botPhoneNumber,
				selectedTemplate.name,
				paramValues,
			);

			setStatus("sent");
			setMode("chat");
			setSelectedTemplate(null);
			setTemplateParams({});

			// Reload conversation to show the new message
			await loadConversation();

			// Clear status after 2 seconds
			setTimeout(() => {
				setStatus("idle");
			}, 2000);
		} catch (error) {
			setStatus("error");
			setErrorMessage(
				error instanceof Error
					? error.message
					: "Failed to send template message",
			);
		}
	};

	const handleSendMessage = async () => {
		if (!currentMessage.trim()) return;

		setStatus("sending");
		setErrorMessage("");

		try {
			await apiClient.sendMessage(
				userPhoneNumber,
				botPhoneNumber,
				currentMessage,
			);
			setStatus("sent");
			setCurrentMessage("");

			// Reload conversation to show the new message
			await loadConversation();

			// Clear status after 2 seconds
			setTimeout(() => {
				setStatus("idle");
			}, 2000);
		} catch (error) {
			setStatus("error");
			setErrorMessage(
				error instanceof Error ? error.message : "Failed to send message",
			);
		}
	};

	const renderMessage = (message: Message) => {
		// Use local timezone
		const now = new Date();
		const msgDate = new Date(message.timestamp);
		const isToday =
			msgDate.getDate() === now.getDate() &&
			msgDate.getMonth() === now.getMonth() &&
			msgDate.getFullYear() === now.getFullYear();

		const timestamp = isToday
			? format(msgDate, "HH:mm:ss")
			: format(msgDate, "MM/dd HH:mm");

		const isOutgoing = message.direction === "sent";
		const messageText = message.text?.trim() || "(empty)";

		// Simplified single-line format for outgoing/incoming
		const prefix = isOutgoing ? "You" : "Bot";
		const header = `${timestamp} ${prefix}`;
		const indentation = "  "; // 2 spaces for indentation

		// By combining into a single Text component with explicit newlines and indentation,
		// we give Ink's wrapping algorithm the best chance to work correctly.
		return (
			<Box key={message.id} marginBottom={1}>
				<Text color={isOutgoing ? "cyan" : "green"} wrap="wrap">
					<Text color="gray" dimColor>
						{header}
					</Text>
					{`\n${indentation}${messageText}`}
				</Text>
			</Box>
		);
	};

	const renderStatusIndicator = () => {
		switch (status) {
			case "sending":
				return <Text color="yellow">Sending...</Text>;
			case "sent":
				return <Text color="green">✓ Sent</Text>;
			case "error":
				return <Text color="red">✗ {errorMessage}</Text>;
			default:
				return null;
		}
	};

	const renderTemplateSelector = () => {
		if (templatesLoading) {
			return (
				<Box justifyContent="center" paddingY={2}>
					<Text color="yellow">Loading templates...</Text>
				</Box>
			);
		}

		if (templates.length === 0) {
			return (
				<Box justifyContent="center" paddingY={2}>
					<Text color="red">No templates available</Text>
				</Box>
			);
		}

		return (
			<Box flexDirection="column">
				<Box marginBottom={1}>
					<Text color="cyan">
						📋 Select a Template ({templates.length} available):
					</Text>
				</Box>

				{templates.map((template, index) => (
					<Box key={`${template.name}_${template.language}`} marginBottom={1}>
						<Text
							color={index === selectedTemplateIndex ? "cyan" : "white"}
							backgroundColor={
								index === selectedTemplateIndex ? "blue" : undefined
							}
						>
							{index === selectedTemplateIndex ? "▶ " : "  "}
							{template.name} ({template.category})
						</Text>
					</Box>
				))}

				<Box marginTop={1}>
					<Text color="gray" dimColor>
						↑/↓: Navigate | Enter: Select | Esc: Back to chat
					</Text>
				</Box>
			</Box>
		);
	};

	const renderTemplateParameterInput = () => {
		if (!selectedTemplate || !currentParamKey) {
			// All parameters filled, show preview
			return (
				<Box flexDirection="column">
					<Box marginBottom={1}>
						<Text color="green">✅ Template ready to send!</Text>
					</Box>

					<Box marginBottom={1}>
						<Text color="cyan">Template: {selectedTemplate?.name}</Text>
					</Box>

					<Box marginBottom={1} flexDirection="column">
						<Text color="yellow">Parameters:</Text>
						{Object.entries(templateParams).map(([key, value]) => (
							<Text key={key} color="white">
								{" "}
								{key}: "{value}"
							</Text>
						))}
					</Box>

					<Box marginTop={1}>
						<Text color="gray" dimColor>
							Ctrl+S: Send template | Esc: Back to templates
						</Text>
					</Box>
				</Box>
			);
		}

		const paramInfo = selectedTemplate.variables?.[currentParamKey];
		const remainingParams =
			Object.keys(selectedTemplate.variables || {}).length -
			Object.keys(templateParams).length;

		return (
			<Box flexDirection="column">
				<Box marginBottom={1}>
					<Text color="cyan">📝 Template: {selectedTemplate.name}</Text>
				</Box>

				<Box marginBottom={1}>
					<Text color="yellow">
						Parameter {currentParamKey} ({remainingParams} remaining):
					</Text>
				</Box>

				{paramInfo && (
					<Box marginBottom={1} flexDirection="column">
						<Text color="gray" dimColor>
							Description: {paramInfo.description}
						</Text>
						<Text color="gray" dimColor>
							Example: {paramInfo.example}
						</Text>
					</Box>
				)}

				<Box marginBottom={1}>
					<TextInput
						value={currentParamValue}
						onChange={setCurrentParamValue}
						placeholder={`Enter value for ${currentParamKey}...`}
						focus={true}
					/>
				</Box>

				<Box marginTop={1}>
					<Text color="gray" dimColor>
						Enter: Set parameter | Esc: Back to templates
					</Text>
				</Box>
			</Box>
		);
	};

	return (
		<Box flexDirection="column" height="100%">
			{/* Main area */}
			<Box flexDirection="column" flexGrow={1} paddingX={2} paddingY={1}>
				{mode === "templates" && renderTemplateSelector()}
				{mode === "template-params" && renderTemplateParameterInput()}

				{mode === "chat" && (
					<>
						{loading && (
							<Box justifyContent="center" paddingY={2}>
								<Text color="yellow">Loading conversation...</Text>
							</Box>
						)}

						{error && (
							<Box justifyContent="center" paddingY={2}>
								<Text color="red">Error: {error}</Text>
							</Box>
						)}

						{!loading && messages.length === 0 && (
							<Box
								flexDirection="column"
								alignItems="center"
								justifyContent="center"
								height="100%"
							>
								{/* Typing indicator for empty conversation */}
								{isAgentTyping && (
									<Box marginBottom={2}>
										<Text color="green" dimColor>
											🤖 Bot is typing...
										</Text>
									</Box>
								)}

								<Text color="gray" dimColor>
									🚀 Ready to test your WhatsApp bot!
								</Text>
								<Box marginTop={1}>
									<Text color="gray" dimColor>
										Type a message below to send to your bot
									</Text>
								</Box>
							</Box>
						)}

						{messages.length > 0 && (
							<Box flexDirection="column">
								<Box marginBottom={1}>
									<Text color="gray" dimColor>
										Conversation ({messages.length} messages) - newest first:
									</Text>
								</Box>

								{/* Typing indicator */}
								{isAgentTyping && (
									<Box marginBottom={1}>
										<Text color="green" dimColor>
											🤖 Bot is typing...
										</Text>
									</Box>
								)}

								<Box flexDirection="column">
									{messages
										.slice()
										.sort(
											(a, b) => b.timestamp.getTime() - a.timestamp.getTime(),
										) // Newest first
										.slice(0, calculateMaxMessages())
										.map(renderMessage)}
								</Box>
								{messages.length > calculateMaxMessages() && (
									<Box marginTop={1}>
										<Text color="gray" dimColor>
											... and {messages.length - calculateMaxMessages()} more
											messages
										</Text>
									</Box>
								)}
							</Box>
						)}
					</>
				)}
			</Box>

			{/* Input area at bottom */}
			{mode === "chat" && (
				<Box
					flexDirection="column"
					borderStyle="single"
					borderColor="gray"
					paddingX={2}
					paddingY={1}
				>
					<Box justifyContent="space-between" marginBottom={1}>
						<Text color="cyan">💬 Send message to bot:</Text>
						{status !== "idle" && renderStatusIndicator()}
					</Box>

					<Box marginBottom={1}>
						<TextInput
							value={currentMessage}
							onChange={setCurrentMessage}
							placeholder="Type your message here..."
							focus={true}
						/>
					</Box>

					<Box justifyContent="space-between">
						<Text color="gray" dimColor>
							Press Enter to send message
						</Text>
						<Text color="gray" dimColor>
							Ctrl+R: Refresh | Ctrl+N: New Chat | Ctrl+T: Templates
						</Text>
					</Box>
				</Box>
			)}
		</Box>
	);
};
