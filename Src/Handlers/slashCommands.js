const { readdirSync } = require('fs');
const path = require('path');
const {
  SlashCommandBuilder,
  InteractionContextType
} = require('discord.js');

/**
   * Load all slash commands from the Commands/Slash directory
   * @param {Client} client - The Discord client instance
   * @returns {Promise<void>}
   */
async function loadSlashCommands(client) {
  try {
    client.slashCommands = client.slashCommands || new Map();
    client.slashCommands.clear();
    const toRegister = [];

    const baseDir = path.join(process.cwd(), 'Src', 'Commands', 'Slash');
    const categories = readdirSync(baseDir, { withFileTypes: true })
      .filter(d => d.isDirectory())
      .map(d => d.name);

    for (const catNameRaw of categories) {
      const catName = catNameRaw.toLowerCase();

      const builder = new SlashCommandBuilder()
        .setName(catName)
        .setDescription(`All ${catNameRaw} commands`)
        .setContexts(
          InteractionContextType.Guild,
          InteractionContextType.BotDM,
          InteractionContextType.PrivateChannel
        );

      const catPath = path.join(baseDir, catNameRaw);
      const entries = readdirSync(catPath, { withFileTypes: true });
      const subdirs = entries.filter(e => e.isDirectory()).map(e => e.name);
      const files = entries.filter(e => e.isFile() && e.name.endsWith('.js')).map(e => e.name);

      // ───────── SUBCOMMAND GROUPS ─────────
      for (const grpNameRaw of subdirs) {
        const grpName = grpNameRaw.toLowerCase();

        builder.addSubcommandGroup(group => {
          group.setName(grpName).setDescription(`All ${grpNameRaw} commands`);
          const subPath = path.join(catPath, grpNameRaw);
          const subFiles = readdirSync(subPath).filter(f => f.endsWith('.js'));

          for (const fileName of subFiles) {
            const fullPath = path.join(subPath, fileName);
            try {
              delete require.cache[require.resolve(fullPath)];
              const mod = require(fullPath);
              const json = extract(mod);
              if (!json) {
                continue;
              }

              group.addSubcommand(sc => applyOptions(sc, json));

              const key = `${catName} ${grpName} ${json.name}`.toLowerCase();
              client.slashCommands.set(key, {
                ...mod,
                category: catNameRaw,
                group: grpNameRaw,
                name: json.name
              });
            } catch (err) {
              console.error(`[SLASH COMMANDS] Failed loading ${fileName}`, err);
            }
          }
          return group;
        });
      }

      // ───────── ROOT SUBCOMMANDS ─────────
      for (const fileName of files) {
        const fullPath = path.join(catPath, fileName);
        try {
          delete require.cache[require.resolve(fullPath)];
          const mod = require(fullPath);
          const json = extract(mod);
          if (!json) {
            continue;
          }

          builder.addSubcommand(sc => applyOptions(sc, json));

          const key = `${catName} ${json.name}`.toLowerCase();
          client.slashCommands.set(key, {
            ...mod,
            category: catNameRaw,
            name: json.name
          });
        } catch (err) {
          console.error(`[SLASH COMMANDS] Failed loading ${fileName}`, err);
        }
      }

      toRegister.push(builder.toJSON());
    }

    await client.application.commands.set(toRegister);
    console.log(
      `[GLOBAL COMMANDS] Registered ${toRegister.length} commands. Loaded ${client.slashCommands.size} handlers.`
    );
  } catch (error) {
    console.error('[SLASH COMMANDS] Loading failed', error);
  }
}

/**
   * Extract command data from a command module
   * @param {object} mod - The command module
   * @returns {object|null} The command data object or null if invalid
   */
function extract(mod) {
  if (!mod.data?.setName || !mod.name || !mod.description) {
    return null;
  }
  const b = mod.data.setName(mod.name).setDescription(mod.description);
  return b.toJSON();
}

/**
   * Apply command options to a subcommand builder
   * @param {SubcommandBuilder} builder - The subcommand builder
   * @param {object} json - The command JSON data
   * @returns {SubcommandBuilder} The configured builder
   */
function applyOptions(builder, json) {
  builder.setName(json  .name).setDescription(json.description);

  (json.options || []).forEach(o => {
    switch (o.type) {
      case 3:
        builder.addStringOption(opt => {
          const op = opt.setName(o.name).setDescription(o.description).setRequired(o.required || false);
          if (o.autocomplete) {
            op.setAutocomplete(true);
          }
          if (o.choices) {
            o.choices.forEach(c => op.addChoices({ name: c.name, value: c.value }));
          }
          return op;
        });
        break;
      case 4:
        builder.addIntegerOption(opt => {
          const op = opt.setName(o.name).setDescription(o.description).setRequired(o.required || false);
          if (o.min_value != null) {
            op.setMinValue(o.min_value);
          }
          if (o.max_value != null) {
            op.setMaxValue(o.max_value);
          }
          return op;
        });
        break;
      case 5:
        builder.addBooleanOption(opt => opt.setName(o.name).setDescription(o.description).setRequired(o.required || false));
        break;
      case 6:
        builder.addUserOption(opt => opt.setName(o.name).setDescription(o.description).setRequired(o.required || false));
        break;
      case 7:
        builder.addChannelOption(opt => opt.setName(o.name).setDescription(o.description).setRequired(o.required || false));
        break;
      case 8:
        builder.addRoleOption(opt => opt.setName(o.name).setDescription(o.description).setRequired(o.required || false));
        break;
      case 9:
        builder.addMentionableOption(opt => opt.setName(o.name).setDescription(o.description).setRequired(o.required || false));
        break;
      case 10:
        builder.addNumberOption(opt => {
          const op = opt.setName(o.name).setDescription(o.description).setRequired(o.required || false);
          if (o.min_value != null) {
            op.setMinValue(o.min_value);
          }
          if (o.max_value != null) {
            op.setMaxValue(o.max_value);
          }
          return op;
        });
        break;
      case 11:
        builder.addAttachmentOption(opt => opt.setName(o.name).setDescription(o.description).setRequired(o.required || false));
        break;
    }
  });

  return builder;
}

module.exports = { loadSlashCommands };
