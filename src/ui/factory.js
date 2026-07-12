import { EmbedBuilder } from 'discord.js';
import { THEME } from '../constants/theme.js';

export class UIFactory {
  /**
   * Constructs a standardized embed.
   * @param {string|null} title
   * @param {string|null} description
   * @param {number} color
   * @param {string|null} icon
   * @param {object} options
   */
  static createBase(title, description, color, icon, options = {}) {
    const embed = new EmbedBuilder().setColor(color);

    // Only set title if non-empty
    if (title) {
      embed.setTitle(icon ? `${icon} ${title}` : title);
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
  static success(title, description, options = {}) {
    return this.createBase(title, description, THEME.colors.success, THEME.icons.success, options);
  }

  /** Vivid red — critical error */
  static error(title, description, options = {}) {
    return this.createBase(title, description, THEME.colors.error, THEME.icons.error, options);
  }

  /** Amber — caution or soft failure */
  static warning(title, description, options = {}) {
    return this.createBase(title, description, THEME.colors.warning, THEME.icons.warning, options);
  }

  /** Sky blue — informational */
  static info(title, description, options = {}) {
    return this.createBase(title, description, THEME.colors.info, THEME.icons.info, options);
  }

  /** Deep violet — default premium neutral */
  static premium(title, description, options = {}) {
    return this.createBase(title, description, THEME.colors.primary, THEME.icons.primary, options);
  }
}
