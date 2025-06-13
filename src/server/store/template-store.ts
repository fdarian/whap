import chokidar from "chokidar";
import { readFile, readdir } from "node:fs/promises";
import { join } from "node:path";
import { validateTemplateData } from "../utils/validator.ts";

/** Template structure based on WhatsApp Business API format */
export interface Template {
	name: string;
	language: string;
	category: "MARKETING" | "UTILITY" | "AUTHENTICATION";
	components: TemplateComponent[];
	variables?: Record<
		string,
		{
			description: string;
			example: string;
		}
	>;
}

export interface TemplateComponent {
	type: "HEADER" | "BODY" | "FOOTER" | "BUTTONS";
	format?: "TEXT" | "IMAGE" | "VIDEO" | "DOCUMENT";
	text?: string;
	buttons?: Array<{
		type: "QUICK_REPLY" | "URL" | "PHONE_NUMBER";
		text: string;
		url?: string;
		phone_number?: string;
	}>;
}

export class TemplateStore {
	private templates: Map<string, Template> = new Map();
	private watcher: chokidar.FSWatcher | null = null;
	private templatesDir: string;
	private isWatching = false;

	constructor(templatesDir = "./templates") {
		// Resolve to absolute path to ensure consistent file watching
		this.templatesDir = join(process.cwd(), templatesDir);
	}

	/** Initialize the template store and start file watching */
	async initialize(): Promise<void> {
		console.log("🗂️  Initializing template store...");

		// Load existing templates
		await this.loadAllTemplates();

		// Start file watcher
		this.startWatcher();

		console.log(
			`📁 Template store initialized with ${this.templates.size} templates`,
		);
	}

	/** Start file watcher for hot-reload functionality */
	private startWatcher(): void {
		if (this.isWatching) {
			return;
		}

		// Watch the entire directory instead of just pattern matching
		console.log(
			`🔍 Setting up file watcher for directory: ${this.templatesDir}`,
		);

		this.watcher = chokidar.watch(this.templatesDir, {
			ignored: /^\./,
			persistent: true,
			ignoreInitial: true,
			depth: 0, // Only watch direct files, not subdirectories
			awaitWriteFinish: {
				stabilityThreshold: 100,
				pollInterval: 50,
			},
		});

		this.watcher
			.on("add", async (path) => {
				if (path.endsWith(".json")) {
					console.log(`📄 Template file added: ${path}`);
					await this.loadTemplate(path);
				}
			})
			.on("change", async (path) => {
				if (path.endsWith(".json")) {
					console.log(`📝 Template file changed: ${path}`);
					await this.loadTemplate(path);
				}
			})
			.on("unlink", (path) => {
				if (path.endsWith(".json")) {
					console.log(`🗑️  Template file removed: ${path}`);
					this.removeTemplateByPath(path);
				}
			})
			.on("error", (error) => {
				console.error("❌ Template watcher error:", error);
			})
			.on("ready", () => {
				console.log("✅ Template file watcher ready");
			});

		this.isWatching = true;
		console.log("👀 Started watching templates directory for changes");
	}

	/** Load all template files from the templates directory */
	private async loadAllTemplates(): Promise<void> {
		try {
			console.log(`📂 Reading templates from: ${this.templatesDir}`);
			const files = await readdir(this.templatesDir);
			console.log(`📋 Found files: ${files.join(", ")}`);

			const jsonFiles = files.filter((file) => file.endsWith(".json"));
			console.log(`📄 JSON files to load: ${jsonFiles.join(", ")}`);

			for (const file of jsonFiles) {
				const filePath = join(this.templatesDir, file);
				console.log(`🔄 Loading template: ${filePath}`);
				await this.loadTemplate(filePath);
			}
		} catch (error) {
			console.warn(
				`⚠️  Could not read templates directory: ${this.templatesDir}`,
			);
			console.error(error);
		}
	}

	/** Load a single template file */
	private async loadTemplate(filePath: string): Promise<void> {
		try {
			const content = await readFile(filePath, "utf-8");
			const templateData = JSON.parse(content);

			// Validate template structure using JSON schema
			const validationResult = validateTemplateData(templateData);
			if (!validationResult.isValid) {
				console.error(`❌ Invalid template structure in ${filePath}:`);
				if (validationResult.errors) {
					for (const error of validationResult.errors) {
						console.error(`  - ${error.path}: ${error.message}`);
					}
				}
				return;
			}

			const template = validationResult.data as Template;
			const templateKey = `${template.name}_${template.language}`;
			this.templates.set(templateKey, template);

			console.log(`✅ Loaded template: ${templateKey}`);
		} catch (error) {
			console.error(`❌ Error loading template from ${filePath}:`, error);
		}
	}

	/** Remove template by file path */
	private removeTemplateByPath(filePath: string): void {
		// Find template by matching the file path (simplified approach)
		for (const [key, template] of this.templates.entries()) {
			if (filePath.includes(template.name)) {
				this.templates.delete(key);
				console.log(`🗑️  Removed template: ${key}`);
				break;
			}
		}
	}

	/** Get template by name and language */
	getTemplate(name: string, language = "en"): Template | undefined {
		const key = `${name}_${language}`;
		return this.templates.get(key);
	}

	/** Get all templates */
	getAllTemplates(): Template[] {
		return Array.from(this.templates.values());
	}

	/** Get templates by category */
	getTemplatesByCategory(category: Template["category"]): Template[] {
		return Array.from(this.templates.values()).filter(
			(template) => template.category === category,
		);
	}

	/** Get template names for listing */
	getTemplateNames(): string[] {
		return Array.from(this.templates.values()).map((template) => template.name);
	}

	/** Get template stats */
	getStats() {
		return {
			totalTemplates: this.templates.size,
			templatesByCategory: {
				MARKETING: this.getTemplatesByCategory("MARKETING").length,
				UTILITY: this.getTemplatesByCategory("UTILITY").length,
				AUTHENTICATION: this.getTemplatesByCategory("AUTHENTICATION").length,
			},
			isWatching: this.isWatching,
			templatesDir: this.templatesDir,
			templateKeys: Array.from(this.templates.keys()),
		};
	}

	/** Manually reload all templates (for testing/debugging) */
	async reloadTemplates(): Promise<void> {
		console.log("🔄 Manually reloading all templates...");
		this.templates.clear();
		await this.loadAllTemplates();
		console.log(`✅ Manually reloaded ${this.templates.size} templates`);
	}

	/** Clean up resources */
	async cleanup(): Promise<void> {
		if (this.watcher) {
			await this.watcher.close();
			this.isWatching = false;
			console.log("🔒 Template watcher stopped");
		}
	}
}

// Export singleton instance
export const templateStore = new TemplateStore();
