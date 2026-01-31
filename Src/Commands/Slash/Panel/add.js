const { SlashCommandSubcommandBuilder, MessageFlags } = require('discord.js');
const db = require('../../../Functions/database');
const ptero = require('../../../Functions/pteroService');

module.exports = {
    name: 'add',
    description: 'Add a new Pterodactyl panel',
    data: new SlashCommandSubcommandBuilder()
        .addStringOption(option =>
            option
                .setName('name')
                .setDescription('Panel name/identifierfor your reference')
                .setRequired(true)
        )
        .addStringOption(option =>
            option
                .setName('url')
                .setDescription('Panel URL (e.g., https://panel.example.com)')
                .setRequired(true)
        )
        .addStringOption(option =>
            option
                .setName('apikey')
                .setDescription('Your Pterodactyl API key')
                .setRequired(true)
        ),

    async execute(client, interaction) {
        try {
            await interaction.deferReply({ flags: [MessageFlags.Ephemeral] });

            const name = interaction.options.getString('name').trim();
            const url = interaction.options.getString('url').trim();
            const apikey = interaction.options.getString('apikey').trim();
            const userId = interaction.user.id;

            // Validate inputs
            if (name.length < 2 || name.length > 32) {
                return await interaction.editReply({
                    content: '❌ Panel name must be between 2 and 32 characters.',
                    flags: [MessageFlags.Ephemeral]
                });
            }

            // Check for duplicate panel name   
            const existingPanel = await db.getPanelByName(userId, name);
            if (existingPanel) {
                return await interaction.editReply({
                    content: `❌ A panel named **${name}** already exists. Please choose a different name or use \`/panel edit\` to update it.`,
                    flags: [MessageFlags.Ephemeral]
                });
            }

            // Normalize URL
            let normalizedUrl = url;
            if (!normalizedUrl.startsWith('http://') && !normalizedUrl.startsWith('https://')) {
                normalizedUrl = 'https://' + normalizedUrl;
            }
            normalizedUrl = normalizedUrl.replace(/\/+$/, ''); // Remove trailing slashes

            // Update status
            await interaction.editReply({
                content: '⏳ Validating panel credentials...',
                flags: [MessageFlags.Ephemeral]
            });

            // Validate credentials
            const validation = await ptero.validateKey(normalizedUrl, apikey);

            if (!validation.valid) {
                return await interaction.editReply({
                    content: `❌ **Validation Failed**\n\n${validation.error}\n\nPlease check your panel URL and API key.`,
                    flags: [MessageFlags.Ephemeral]
                });
            }

            // Save panel
            await db.savePanel(userId, {
                name: name,
                url: normalizedUrl,
                apikey: apikey,
                active: true
            });

            // Success message
            const successMessage = [
                '✅ **Panel Added Successfully!**',
                '━━━━━━━━━━━━━━━━',
                `📝 **Name:** ${name}`,
                `🌐 **URL:** ${normalizedUrl}`,
                `👤 **Account:** ${validation.username} (${validation.email})`,
                `🆔 **UUID:** \`${validation.uuid}\``,
                '',
                '✨ Your panel is now active and ready to use!'
            ].join('\n');

            await interaction.editReply({
                content: successMessage,
                flags: [MessageFlags.Ephemeral]
            });

        } catch (error) {
            console.error('[PANEL ADD] Error:', error);

            const errorMessage = error.userMessage || error.message || 'An unexpected error occurred while adding the panel.';

            await interaction.editReply({
                content: `❌ **Error Adding Panel**\n\n${errorMessage}`,
                flags: [MessageFlags.Ephemeral]
            }).catch(() => { });
        }
    }
};
