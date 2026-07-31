document.addEventListener('DOMContentLoaded', async () => {
    try {
        // Fetch live stats from the bot's API
        const response = await fetch('/api/stats');
        
        if (response.ok) {
            const data = await response.json();
            
            // Animate counting up for numbers
            animateValue("stat-servers", 0, data.servers, 1000);
            animateValue("stat-users", 0, data.users, 1000);
            animateValue("stat-commands", 0, data.commands, 1000);
            
            // Just set ping
            document.getElementById('stat-ping').innerText = `${data.ping}ms`;
        } else {
            console.error('Failed to load stats');
        }
    } catch (error) {
        console.error('Error fetching bot stats:', error);
    }
});

// Cute number counting animation
function animateValue(id, start, end, duration) {
    if (start === end) {
        document.getElementById(id).innerText = end;
        return;
    }
    
    let startTimestamp = null;
    const step = (timestamp) => {
        if (!startTimestamp) startTimestamp = timestamp;
        const progress = Math.min((timestamp - startTimestamp) / duration, 1);
        
        // Use easeOutQuart for smooth slow-down at the end
        const easeProgress = 1 - Math.pow(1 - progress, 4);
        const current = Math.floor(easeProgress * (end - start) + start);
        
        document.getElementById(id).innerText = current;
        if (progress < 1) {
            window.requestAnimationFrame(step);
        } else {
            document.getElementById(id).innerText = end;
        }
    };
    window.requestAnimationFrame(step);
}
