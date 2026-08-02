import { EmbedBuilder, ActionRowBuilder, ButtonBuilder, StringSelectMenuBuilder, ModalBuilder, TextInputBuilder, ButtonStyle, TextInputStyle, StringSelectMenuOptionBuilder } from 'discord.js';
import { THEME } from '../constants/theme.js';
import type { EmbedOptions } from '../types/index.js';

export class UIFactory {
  // ─── Embeds ──────────────────────────────────────────────────────────────

  static createBase(
    title: string | null,
    description: string | null,
    color: number,
    icon: string,
    options: EmbedOptions = {}
  ): EmbedBuilder {
    const embed = new EmbedBuilder().setColor(color);

    if (title) {
      // Use author for a cleaner look instead of massive titles
      embed.setAuthor({ name: `${icon}  ${title}`, iconURL: options.author?.iconURL });
    } else if (options.author) {
      embed.setAuthor(options.author);
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

    return embed;
  }

  static success(title: string | null, description: string | null, options: EmbedOptions = {}): EmbedBuilder {
    return this.createBase(title, description, THEME.colors.success, THEME.icons.success, options);
  }

  static error(title: string | null, description: string | null, options: EmbedOptions = {}): EmbedBuilder {
    return this.createBase(title, description, THEME.colors.error, THEME.icons.error, options);
  }

  static warning(title: string | null, description: string | null, options: EmbedOptions = {}): EmbedBuilder {
    return this.createBase(title, description, THEME.colors.warning, THEME.icons.warning, options);
  }

  static info(title: string | null, description: string | null, options: EmbedOptions = {}): EmbedBuilder {
    return this.createBase(title, description, THEME.colors.info, THEME.icons.info, options);
  }

  static premium(title: string | null, description: string | null, options: EmbedOptions = {}): EmbedBuilder {
    return this.createBase(title, description, THEME.colors.primary, THEME.icons.primary, options);
  }

  // ─── Components ──────────────────────────────────────────────────────────

  static button(customId: string, label: string, style: ButtonStyle = ButtonStyle.Primary, emoji?: string, disabled = false): ButtonBuilder {
    const btn = new ButtonBuilder()
      .setCustomId(customId)
      .setLabel(label)
      .setStyle(style)
      .setDisabled(disabled);
    
    if (emoji) btn.setEmoji(emoji);
    return btn;
  }

  static linkButton(url: string, label: string, emoji?: string): ButtonBuilder {
    const btn = new ButtonBuilder()
      .setURL(url)
      .setLabel(label)
      .setStyle(ButtonStyle.Link);
      
    if (emoji) btn.setEmoji(emoji);
    return btn;
  }

  static selectMenu(customId: string, placeholder: string, options: { label: string; value: string; description?: string; emoji?: string }[], minValues = 1, maxValues = 1): StringSelectMenuBuilder {
    const menu = new StringSelectMenuBuilder()
      .setCustomId(customId)
      .setPlaceholder(placeholder)
      .setMinValues(minValues)
      .setMaxValues(maxValues);

    const optionBuilders = options.map(opt => {
      const option = new StringSelectMenuOptionBuilder()
        .setLabel(opt.label)
        .setValue(opt.value);
      if (opt.description) option.setDescription(opt.description);
      if (opt.emoji) option.setEmoji(opt.emoji);
      return option;
    });

    menu.addOptions(optionBuilders);
    return menu;
  }

  static actionRow<T extends ButtonBuilder | StringSelectMenuBuilder>(...components: T[]): ActionRowBuilder<T> {
    return new ActionRowBuilder<T>().addComponents(components);
  }

  static modal(customId: string, title: string, ...inputs: TextInputBuilder[]): ModalBuilder {
    const modal = new ModalBuilder()
      .setCustomId(customId)
      .setTitle(title);

    const rows = inputs.map(input => new ActionRowBuilder<TextInputBuilder>().addComponents(input));
    modal.addComponents(rows);
    return modal;
  }

  static textInput(customId: string, label: string, style: TextInputStyle = TextInputStyle.Short, required = true, placeholder?: string, value?: string): TextInputBuilder {
    const input = new TextInputBuilder()
      .setCustomId(customId)
      .setLabel(label)
      .setStyle(style)
      .setRequired(required);

    if (placeholder) input.setPlaceholder(placeholder);
    if (value) input.setValue(value);
    
    return input;
  }
}
