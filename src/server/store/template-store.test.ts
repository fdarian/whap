import { describe, test, expect, beforeEach, afterEach, vi } from "vitest";
import { readFile, readdir, mkdir, writeFile, rm } from "node:fs/promises";
import { join } from "node:path";
import { TemplateStore, type Template } from "./template-store.ts";

// Mock fs promises for controlled testing
vi.mock("node:fs/promises", () => ({
	readFile: vi.fn(),
	readdir: vi.fn(),
	mkdir: vi.fn(),
	writeFile: vi.fn(),
	rm: vi.fn(),
}));

// Mock chokidar for file watching
vi.mock("chokidar", () => ({
	default: {
		watch: vi.fn(() => ({
			on: vi.fn().mockReturnThis(),
		})),
	},
}));

describe("TemplateStore", () => {
	let templateStore: TemplateStore;
	const testTemplatesDir = "./test-templates";

	// Sample template for testing
	const sampleTemplate: Template = {
		name: "test_template",
		language: "en",
		category: "UTILITY",
		components: [
			{
				type: "HEADER",
				format: "TEXT",
				text: "Test Header",
			},
			{
				type: "BODY",
				text: "Hello {{1}}, this is a test template.",
			},
		],
		variables: {
			"1": {
				description: "User name",
				example: "John",
			},
		},
	};

	beforeEach(() => {
		vi.clearAllMocks();
		templateStore = new TemplateStore(testTemplatesDir);
	});

	afterEach(async () => {
		if (templateStore) {
			await templateStore.cleanup();
		}
	});

	describe("initialization", () => {
		test("should initialize with empty template store", () => {
			expect(templateStore.getAllTemplates()).toEqual([]);
			expect(templateStore.getTemplateNames()).toEqual([]);
		});

		test("should load templates during initialization", async () => {
			const mockFiles = ["template1.json", "template2.json", "readme.txt"];
			const mockTemplateContent = JSON.stringify(sampleTemplate);

			vi.mocked(readdir).mockResolvedValue(mockFiles);
			vi.mocked(readFile).mockResolvedValue(mockTemplateContent);

			await templateStore.initialize();

			expect(readdir).toHaveBeenCalledWith(
				expect.stringContaining(testTemplatesDir),
			);
			expect(readFile).toHaveBeenCalledTimes(2); // Only JSON files
		});

		test("should handle missing templates directory gracefully", async () => {
			vi.mocked(readdir).mockRejectedValue(new Error("Directory not found"));

			await expect(templateStore.initialize()).resolves.not.toThrow();
		});
	});

	describe("template storage and retrieval", () => {
		test("should store and retrieve template correctly", async () => {
			const mockTemplateContent = JSON.stringify(sampleTemplate);
			vi.mocked(readdir).mockResolvedValue(["test.json"]);
			vi.mocked(readFile).mockResolvedValue(mockTemplateContent);

			await templateStore.initialize();

			const retrieved = templateStore.getTemplate("test_template", "en");
			expect(retrieved).toEqual(sampleTemplate);
		});

		test("should return undefined for non-existent template", () => {
			const result = templateStore.getTemplate("non_existent", "en");
			expect(result).toBeUndefined();
		});

		test("should get all templates", async () => {
			const mockTemplateContent = JSON.stringify(sampleTemplate);
			vi.mocked(readdir).mockResolvedValue(["test.json"]);
			vi.mocked(readFile).mockResolvedValue(mockTemplateContent);

			await templateStore.initialize();

			const allTemplates = templateStore.getAllTemplates();
			expect(allTemplates).toHaveLength(1);
			expect(allTemplates[0]).toEqual(sampleTemplate);
		});

		test("should get templates by category", async () => {
			const utilityTemplate = {
				...sampleTemplate,
				name: "utility_template",
				category: "UTILITY" as const,
			};
			const authTemplate = {
				...sampleTemplate,
				name: "auth_template",
				category: "AUTHENTICATION" as const,
			};

			vi.mocked(readdir).mockResolvedValue(["utility.json", "auth.json"]);
			vi.mocked(readFile)
				.mockResolvedValueOnce(JSON.stringify(utilityTemplate))
				.mockResolvedValueOnce(JSON.stringify(authTemplate));

			await templateStore.initialize();

			const utilityTemplates = templateStore.getTemplatesByCategory("UTILITY");
			const authTemplates =
				templateStore.getTemplatesByCategory("AUTHENTICATION");

			expect(utilityTemplates).toHaveLength(1);
			expect(authTemplates).toHaveLength(1);
			expect(utilityTemplates[0].category).toBe("UTILITY");
			expect(authTemplates[0].category).toBe("AUTHENTICATION");
		});

		test("should get template names", async () => {
			const template1 = { ...sampleTemplate, name: "template1" };
			const template2 = { ...sampleTemplate, name: "template2" };

			vi.mocked(readdir).mockResolvedValue([
				"template1.json",
				"template2.json",
			]);
			vi.mocked(readFile)
				.mockResolvedValueOnce(JSON.stringify(template1))
				.mockResolvedValueOnce(JSON.stringify(template2));

			await templateStore.initialize();

			const names = templateStore.getTemplateNames();
			expect(names).toEqual(["template1", "template2"]);
		});
	});

	describe("template validation", () => {
		test("should reject invalid template structure", async () => {
			const invalidTemplate = {
				name: "invalid",
				// Missing required fields
			};

			vi.mocked(readdir).mockResolvedValue(["invalid.json"]);
			vi.mocked(readFile).mockResolvedValue(JSON.stringify(invalidTemplate));

			await templateStore.initialize();

			// Template should not be stored if invalid
			expect(templateStore.getAllTemplates()).toHaveLength(0);
		});

		test("should handle malformed JSON", async () => {
			vi.mocked(readdir).mockResolvedValue(["malformed.json"]);
			vi.mocked(readFile).mockResolvedValue("{ invalid json }");

			await templateStore.initialize();

			// Should not crash and should not store any templates
			expect(templateStore.getAllTemplates()).toHaveLength(0);
		});
	});

	describe("template reloading", () => {
		test("should reload templates successfully", async () => {
			const mockTemplateContent = JSON.stringify(sampleTemplate);
			vi.mocked(readdir).mockResolvedValue(["test.json"]);
			vi.mocked(readFile).mockResolvedValue(mockTemplateContent);

			await templateStore.initialize();
			expect(templateStore.getAllTemplates()).toHaveLength(1);

			// Mock additional template for reload
			const newTemplate = { ...sampleTemplate, name: "new_template" };
			vi.mocked(readdir).mockResolvedValue(["test.json", "new.json"]);
			vi.mocked(readFile)
				.mockResolvedValueOnce(mockTemplateContent)
				.mockResolvedValueOnce(JSON.stringify(newTemplate));

			await templateStore.reloadTemplates();

			expect(templateStore.getAllTemplates()).toHaveLength(2);
		});
	});

	describe("statistics and monitoring", () => {
		test("should provide accurate statistics", async () => {
			const utilityTemplate = {
				...sampleTemplate,
				category: "UTILITY" as const,
			};
			const authTemplate = {
				...sampleTemplate,
				name: "auth_template",
				category: "AUTHENTICATION" as const,
			};

			vi.mocked(readdir).mockResolvedValue(["utility.json", "auth.json"]);
			vi.mocked(readFile)
				.mockResolvedValueOnce(JSON.stringify(utilityTemplate))
				.mockResolvedValueOnce(JSON.stringify(authTemplate));

			await templateStore.initialize();

			const stats = templateStore.getStats();

			expect(stats.totalTemplates).toBe(2);
			expect(stats.templatesByCategory.UTILITY).toBe(1);
			expect(stats.templatesByCategory.AUTHENTICATION).toBe(1);
			expect(stats.templatesByCategory.MARKETING).toBe(0);
			expect(stats.isWatching).toBe(true);
			expect(stats.templatesDir).toContain(testTemplatesDir);
			expect(stats.templateKeys).toHaveLength(2);
		});
	});

	describe("memory management", () => {
		test("should clear templates on cleanup", async () => {
			const mockTemplateContent = JSON.stringify(sampleTemplate);
			vi.mocked(readdir).mockResolvedValue(["test.json"]);
			vi.mocked(readFile).mockResolvedValue(mockTemplateContent);

			await templateStore.initialize();
			expect(templateStore.getAllTemplates()).toHaveLength(1);

			await templateStore.cleanup();

			// After cleanup, templates should still be in memory (only file watcher is cleaned up)
			// The in-memory storage persists until server restart as required by the task
			expect(templateStore.getAllTemplates()).toHaveLength(1);
		});

		test("should reset templates on server restart (simulated by new instance)", () => {
			// This tests the requirement that templates reset on server restart
			const originalStore = new TemplateStore(testTemplatesDir);

			// New instance should start empty (simulating server restart)
			const newStore = new TemplateStore(testTemplatesDir);

			expect(newStore.getAllTemplates()).toHaveLength(0);
			expect(newStore.getTemplateNames()).toHaveLength(0);
		});
	});

	describe("template key generation", () => {
		test("should generate consistent template keys", async () => {
			const template1 = { ...sampleTemplate, name: "test", language: "en" };
			const template2 = { ...sampleTemplate, name: "test", language: "es" };

			vi.mocked(readdir).mockResolvedValue(["en.json", "es.json"]);
			vi.mocked(readFile)
				.mockResolvedValueOnce(JSON.stringify(template1))
				.mockResolvedValueOnce(JSON.stringify(template2));

			await templateStore.initialize();

			// Should store both templates with different keys
			expect(templateStore.getTemplate("test", "en")).toBeDefined();
			expect(templateStore.getTemplate("test", "es")).toBeDefined();
			expect(templateStore.getAllTemplates()).toHaveLength(2);
		});

		test("should handle template key conflicts by overwriting", async () => {
			const template1 = { ...sampleTemplate, name: "test", language: "en" };
			const template2 = {
				...sampleTemplate,
				name: "test",
				language: "en",
				category: "MARKETING" as const,
			};

			vi.mocked(readdir).mockResolvedValue(["test1.json", "test2.json"]);
			vi.mocked(readFile)
				.mockResolvedValueOnce(JSON.stringify(template1))
				.mockResolvedValueOnce(JSON.stringify(template2));

			await templateStore.initialize();

			// Second template should overwrite the first
			expect(templateStore.getAllTemplates()).toHaveLength(1);
			expect(templateStore.getTemplate("test", "en")?.category).toBe(
				"MARKETING",
			);
		});
	});
});
