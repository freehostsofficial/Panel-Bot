const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const db = require('../../../../Functions/database');
const ptero = require('../../../../Functions/pteroService');

module.exports = {
    name: "info",
    description: "Perform a security audit on a panel gateway connection.",
    category: "Panel",
    data: new SlashCommandBuilder()
        .setName("info")
        .setDescription("Perform a security audit on a panel gateway connection.")
        .addStringOption(opt => opt.setName("name").setDescription("Panel name").setRequired(true).setAutocomplete(true)),

    async autocomplete(interaction) {
        const focusedValue = interaction.options.getFocused().toLowerCase();
        const userData = await db.getUserData(interaction.user.id);
        const panels = userData.panels || [];
        const filtered = panels.filter(p => p.name.toLowerCase().includes(focusedValue));
        await interaction.respond(filtered.map(p => ({ name: p.name, value: p.name })));
    },

    async execute(client, interaction) {
        await interaction.deferReply({ ephemeral: true });

        const userId = interaction.user.id;
        const name = interaction.options.getString("name");
        const userData = await db.getUserData(userId);
        const panel = userData.panels.find(p => p.name.toLowerCase() === name.toLowerCase());

        if (!panel) return interaction.editReply(`❌ Panel **${name}** not found.`);

        let accountInfo = null;
        let serverCount = 0;
        let connectionStatus = '🔴 Disconnected';
        let statusColor = '#ff5252';

        try {
            const validation = await ptero.validateKey(panel.url, panel.apikey);
            if (validation.valid) {
                connectionStatus = '🟢 Connected & Verified';
                statusColor = '#52ff52';
                accountInfo = validation;
                const servers = await ptero.listServers(panel.url, panel.apikey);
                serverCount = servers.length;
            }
        } catch (err) {
            connectionStatus = `⚠️ API Error: ${err.message}`;
        }

        const domain = new URL(panel.url).hostname;

        const embed = new EmbedBuilder()
            .setColor(statusColor)
            .setTitle(`🛡️ Security Audit: ${panel.name}`)
            .setDescription('Standby panel instance.')
            .addFields(
                {
                    name: '🌐 Remote Endpoint',
                    value: `\`\`\`yml\nHost: ${domain}\nURL: ${panel.url}\nStatus: ${connectionStatus}\n\`\`\``,
                    inline: false
                },
                {
                    name: '👤 Identity Info',
                    value: `\`\`\`yml\nUser: ${accountInfo?.username || 'N/A'}\nEmail: ${accountInfo?.email || 'N/A'}\nAdmin: ${accountInfo?.root_admin ? 'Yes' : 'No'}\n\`\`\``,
                    inline: true
                },
                {
                    name: '📊 Instance Stats',
                    value: `\`\`\`yml\nServers: ${serverCount}\nAuth: User Key\n\`\`\``,
                    inline: true
                },
                {
                    name: '🔒 Authorization',
                    value: `\`\`\`\nKey prefix: ${panel.apikey.substring(0, 16)}...\n\`\`\``,
                    inline: false
                }
            )
            .setFooter({ text: `ID: ${panel.name.toLowerCase().replace(/\s+/g, '_')} • Panel Management` })
            .setTimestamp();

        await interaction.editReply({ embeds: [embed] });
    }
};
