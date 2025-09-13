/**
 * Connection test example for the IB Client Portal SDK
 * 
 * This simple script tests the connection to IB Gateway
 * and provides diagnostic information.
 */

import { createClient, ConnectionError } from '../src/index.js';

async function testConnection() {
    console.log('🔍 IB Gateway Connection Test\n');
    
    const client = createClient({
        host: '127.0.0.1',
        port: 5000,
        timeout: 10000 // 10 second timeout
    });
    
    console.log(`📡 Testing connection to ${client.config.baseUrl}`);
    console.log(`⏱️  Timeout: ${client.config.timeout}ms`);
    console.log(`🔒 SSL Verification: ${client.config.verifySsl}`);
    console.log(`⚡ Rate Limit: ${client.config.rateLimit} req/sec\n`);
    
    try {
        console.log('🚀 Attempting to connect...');
        const startTime = Date.now();
        
        const healthStatus = await client.checkHealth();
        
        const endTime = Date.now();
        const responseTime = endTime - startTime;
        
        console.log('✅ Connection successful!');
        console.log(`⏱️  Response time: ${responseTime}ms`);
        console.log('📊 Health Status:');
        console.log(JSON.stringify(healthStatus, null, 2));
        
        // Test authentication status
        console.log('\n🔐 Checking authentication...');
        const authStatus = await client.getAuthStatus();
        
        if (authStatus.authenticated) {
            console.log('✅ Authenticated successfully');
            console.log(`👤 User: ${authStatus.userId || 'Unknown'}`);
            console.log(`🏢 Server: ${authStatus.serverInfo?.serverName || 'Unknown'}`);
        } else {
            console.log('⚠️  Not authenticated');
            console.log('💡 To authenticate:');
            console.log('   1. Open IB Gateway or TWS');
            console.log('   2. Log in with your credentials');
            console.log('   3. Make sure API is enabled');
        }
        
        console.log('\n🎉 Connection test completed successfully!');
        
    } catch (error) {
        console.error('❌ Connection test failed:');
        
        if (error instanceof ConnectionError) {
            console.error(`🔌 ${error.message}`);
            console.error('\n🛠️  Troubleshooting:');
            console.error('   1. Make sure IB Gateway is running');
            console.error('   2. Check that port 5000 is correct');
            console.error('   3. Verify API connections are enabled');
            console.error('   4. Check firewall settings');
        } else {
            console.error(`💥 ${error.message}`);
            if (error.stack) {
                console.error('\nStack trace:');
                console.error(error.stack);
            }
        }
        
        process.exit(1);
    }
}

// Run the test
testConnection().catch(console.error);
