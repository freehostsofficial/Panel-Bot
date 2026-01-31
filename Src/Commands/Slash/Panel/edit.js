const { SlashCommandSubcommandBuilder, MessageFlags } = require('discord.js');
const db = require('../../../Functions/database');
const ptero = require('../../../Functions/pteroService');
const pteroUtils = require('../../../Functions/pteroUtils');

module.exports = {
    name: 'edit',
    description: 'Edit panel URL or API key',
    data: new SlashCommandSubcommandBuilder()
        .addStringOption(option =>
            option
                .setName('name')
                .setDescription('Panel to edit')
                .setRequired(true)
                .setAutocomplete(true)
        )
        .addStringOption(option =>
            option
                .setName('url')
                .setDescription('New panel URL (optional)')
                .setRequired(false)
        )
        .addStringOption(option =>
            option
                .setName('apikey')
                .setDescription('New API key (optional)')
                .setRequired(false)
        ),

    async autocomplete(interaction) {
        await pteroUtils.panelAutocomplete(interaction);
    },

    async execute(client, interaction) {
        try {
            await interaction.deferReply({ flags: [MessageFlags.Ephemeral] });

            const name = interaction.options.getString('name');
            const newUrl = interaction.options.getString('url');
            const newApikey = interaction.options.getString('apikey');
            const userId = interaction.user.id;

            // Check for invalid autocomplete values
            if (['no_panels', 'no_match', 'error'].includes(name)) {
                return await interaction.editReply({
                    content: '❌ No panel selected. Please try the command again.',
                    flags: [MessageFlags.Ephemeral]
                });
            }

            // At least one field must be provided
            if (!newUrl && !newApikey) {
                return await interaction.editReply({
                    content: '❌ Please provide at least one field to update (URL or API key).',
                    flags: [MessageFlags.Ephemeral]
                });
            }

            // Get existing panel
            const panel = await db.getPanelByName(userId, name);
            if (!panel) {
                return await interaction.editReply({
                    content: `❌ Panel **${name}** not found.`,
                    flags: [MessageFlags.Ephemeral]
                });
            }

            // Prepare updates
            const updates = {};
            let urlToValidate = panel.url;
            let apikeyToValidate = panel.apikey;

            if (newUrl) {
                let normalizedUrl = newUrl.trim();
                if (!normalizedUrl.startsWith('http://') && !normalizedUrl.startsWith('https://')) {
                    normalizedUrl = 'https://' + normalizedUrl;
                }
                normalizedUrl = normalizedUrl.replace(/\/+$/, '');
                updates.url = normalizedUrl;
                urlToValidate = normalizedUrl;
            }

            if (newApikey) {
                updates.apikey = newApikey.trim();
                apikeyToValidate = newApikey.trim();
            }

            // Validate new credentials
            await interaction.editReply({
                content: '⏳ Validating new credentials...',
                flags: [MessageFlags.Ephemeral]
            });

            const validation = await ptero.validateKey(urlToValidate, apikeyToValidate);

            if (!validation.valid) {
                return await interaction.editReply({
                    content: `❌ **Validation Failed**\n\n${validation.error}\n\nPlease check your panel URL and API key.`,
                    flags: [MessageFlags.Ephemeral]
                });
            }

            // Update panel
            await db.updatePanel(userId, name, updates);

            const updatedFields = [];
            if (newUrl) updatedFields.push(`🌐 URL updated to: ${updates.url}`);
            if (newApikey) updatedFields.push('🔑 API key updated');

            const successMessage = [
                '✅ **Panel Updated Successfully!**',
                '━━━━━━━━━━━━━━━━',
                `📝 **Panel:** ${name}`,
                ...updatedFields,
                `👤 **Account:** ${validation.username} (${validation.email})`,
                '',
                '✨ Your panel credentials have been updated!'
            ].join('\n');

            await interaction.editReply({
                content: successMessage,
                flags: [MessageFlags.Ephemeral]
            });

        } catch (error) {
            console.error('[PANEL EDIT] Error:', error);

            const errorMessage = error.userMessage || error.message || 'An unexpected error occurred.';

            await interaction.editReply({
                content: `❌ **Error Updating Panel**\n\n${errorMessage}`,
                flags: [MessageFlags.Ephemeral]
            }).catch(() => { });
        }
    }
};
