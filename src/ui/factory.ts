import { EmbedBuilder } from 'discord.js';
import { THEME } from '../constants/theme.js';
import type { EmbedOptions } from '../types/index.js';

export class UIFactory {
  /**
   * Constructs a standardized embed.
   */
  static createBase(
    title: string | null,
    description: string | null,
    color: number,
    icon: string,
    options: EmbedOptions = {}
  ): EmbedBuilder {
    const embed = new EmbedBuilder().setColor(color);

    if (title) {
      embed.setTitle(icon ? `${icon}   ${title}` : title);
    }

    if (description) {
      embed.setDescription(description);
    }

    if (options.timestamp !== false) {
      embed.setTimestamp(new Date());
    }

    if (options.fields?.length) {
      embed.addFields(options.fields);
    }

    if (options.footer !== false) {
      embed.setFooter({
        text: options.footerText || THEME.footer.text,
        iconURL: options.footerIcon || THEME.footer.iconURL || undefined,
      });
    }

    if (options.thumbnail) {
      embed.setThumbnail(options.thumbnail);
    }

    if (options.image) {
      embed.setImage(options.image);
    }

    if (options.author) {
      embed.setAuthor({
        name: options.author.name,
        iconURL: options.author.iconURL,
        url: options.author.url,
      });
    }

    return embed;
  }

  /** Vibrant green — operation success */
  static success(title: string | null, description: string | null, options: EmbedOptions = {}): EmbedBuilder {
    return this.createBase(title, description, THEME.colors.success, THEME.icons.success, options);
  }

  /** Vivid red — critical error */
  static error(title: string | null, description: string | null, options: EmbedOptions = {}): EmbedBuilder {
    return this.createBase(title, description, THEME.colors.error, THEME.icons.error, options);
  }

  /** Amber — caution or soft failure */
  static warning(title: string | null, description: string | null, options: EmbedOptions = {}): EmbedBuilder {
    return this.createBase(title, description, THEME.colors.warning, THEME.icons.warning, options);
  }

  /** Sky blue — informational */
  static info(title: string | null, description: string | null, options: EmbedOptions = {}): EmbedBuilder {
    return this.createBase(title, description, THEME.colors.info, THEME.icons.info, options);
  }

  /** Deep violet — default premium neutral */
  static premium(title: string | null, description: string | null, options: EmbedOptions = {}): EmbedBuilder {
    return this.createBase(title, description, THEME.colors.primary, THEME.icons.primary, options);
  }
}
