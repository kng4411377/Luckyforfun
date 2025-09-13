/**
 * Order management example for the IB Client Portal SDK
 * 
 * This example demonstrates how to:
 * 1. Place different types of orders
 * 2. Monitor live orders
 * 3. Modify and cancel orders
 * 4. Place bracket orders
 * 5. View executions/trades
 */

import { 
    createOrderClient, 
    OrderTypes, 
    OrderSides, 
    TimeInForce,
    AuthenticationError, 
    InvalidSymbolError 
} from '../src/index.js';

async function orderManagementExample() {
    console.log('📋 IB Client Portal SDK - Order Management Example\n');
    
    // Create an order client
    const orderClient = createOrderClient({
        host: '127.0.0.1',
        port: 5000,
        rateLimit: 1.0 // 1 request per second for safety
    });
    
    try {
        // Step 1: Check connection and authentication
        console.log('🔐 Checking authentication...');
        const authStatus = await orderClient.client.getAuthStatus();
        
        if (!authStatus.authenticated) {
            console.log('⚠️  Not authenticated. Please log in to IB Gateway first.');
            console.log('   Make sure you are using a PAPER TRADING account!');
            return;
        }
        
        console.log('✅ Authenticated successfully!');
        
        // Get account information
        const accounts = await orderClient.client.getAccounts();
        console.log('📊 Available accounts:', accounts.map(acc => acc.accountId));
        
        const paperAccount = accounts.find(acc => acc.accountId.startsWith('DU'));
        if (!paperAccount) {
            console.log('⚠️  No paper trading account found. Please use paper trading for testing.');
            return;
        }
        
        console.log(`💼 Using paper trading account: ${paperAccount.accountId}\n`);
        
        // Step 2: Place different types of orders
        console.log('📈 Placing different order types...\n');
        
        const symbol = 'AAPL';
        const quantity = 10; // Small quantity for testing
        
        // Example 1: Market Order
        console.log('1️⃣ Placing Market Order...');
        try {
            const marketOrder = await orderClient.placeMarketOrder(symbol, OrderSides.BUY, quantity, {
                timeInForce: TimeInForce.DAY
            });
            console.log('✅ Market order placed:', JSON.stringify(marketOrder, null, 2));
        } catch (error) {
            console.log('❌ Market order failed:', error.message);
        }
        console.log('');
        
        // Example 2: Limit Order
        console.log('2️⃣ Placing Limit Order...');
        try {
            const limitOrder = await orderClient.placeLimitOrder(symbol, OrderSides.BUY, quantity, 150.00, {
                timeInForce: TimeInForce.GTC
            });
            console.log('✅ Limit order placed:', JSON.stringify(limitOrder, null, 2));
        } catch (error) {
            console.log('❌ Limit order failed:', error.message);
        }
        console.log('');
        
        // Example 3: Stop Order
        console.log('3️⃣ Placing Stop Order...');
        try {
            const stopOrder = await orderClient.placeStopOrder(symbol, OrderSides.SELL, quantity, 140.00);
            console.log('✅ Stop order placed:', JSON.stringify(stopOrder, null, 2));
        } catch (error) {
            console.log('❌ Stop order failed:', error.message);
        }
        console.log('');
        
        // Example 4: Stop-Limit Order
        console.log('4️⃣ Placing Stop-Limit Order...');
        try {
            const stopLimitOrder = await orderClient.placeStopLimitOrder(
                symbol, OrderSides.SELL, quantity, 140.00, 139.50
            );
            console.log('✅ Stop-limit order placed:', JSON.stringify(stopLimitOrder, null, 2));
        } catch (error) {
            console.log('❌ Stop-limit order failed:', error.message);
        }
        console.log('');
        
        // Example 5: Trailing Stop Order
        console.log('5️⃣ Placing Trailing Stop Order...');
        try {
            // Trail by $2.00
            const trailingStopOrder = await orderClient.placeTrailingStopOrder(
                symbol, OrderSides.SELL, quantity, 2.00
            );
            console.log('✅ Trailing stop order placed:', JSON.stringify(trailingStopOrder, null, 2));
        } catch (error) {
            console.log('❌ Trailing stop order failed:', error.message);
        }
        console.log('');
        
        // Example 6: Bracket Order
        console.log('6️⃣ Placing Bracket Order...');
        try {
            const bracketOrder = await orderClient.placeBracketOrder(
                symbol, 
                OrderSides.BUY, 
                quantity,
                { orderType: OrderTypes.MARKET }, // Parent order
                { price: 160.00 },                // Profit target
                { price: 140.00 }                 // Stop loss
            );
            console.log('✅ Bracket order placed:', JSON.stringify(bracketOrder, null, 2));
        } catch (error) {
            console.log('❌ Bracket order failed:', error.message);
        }
        console.log('');
        
        // Step 3: Monitor live orders
        console.log('👀 Checking live orders...');
        try {
            const liveOrders = await orderClient.getLiveOrders();
            console.log(`📋 Found ${liveOrders.length} live orders:`);
            
            liveOrders.forEach((order, index) => {
                console.log(`  ${index + 1}. Order ID: ${order.orderId}`);
                console.log(`     Symbol: ${order.ticker || 'N/A'}`);
                console.log(`     Side: ${order.side}, Quantity: ${order.totalSize}`);
                console.log(`     Type: ${order.orderType}, Status: ${order.status}`);
                console.log(`     Price: ${order.price || 'N/A'}`);
                console.log('');
            });
            
            // Step 4: Demonstrate order modification (if we have orders)
            if (liveOrders.length > 0) {
                const firstOrder = liveOrders[0];
                console.log(`🔧 Attempting to modify order ${firstOrder.orderId}...`);
                
                try {
                    // Only modify if it's a limit order
                    if (firstOrder.orderType === 'LMT' && firstOrder.price) {
                        const newPrice = parseFloat(firstOrder.price) + 1.00; // Increase price by $1
                        const modifyResult = await orderClient.modifyOrder(firstOrder.orderId, {
                            price: newPrice
                        });
                        console.log('✅ Order modified:', JSON.stringify(modifyResult, null, 2));
                    } else {
                        console.log('⚠️  Order is not a limit order, skipping modification');
                    }
                } catch (error) {
                    console.log('❌ Order modification failed:', error.message);
                }
                console.log('');
                
                // Step 5: Demonstrate order cancellation
                console.log(`🗑️  Attempting to cancel order ${firstOrder.orderId}...`);
                try {
                    const cancelResult = await orderClient.cancelOrder(firstOrder.orderId);
                    console.log('✅ Order cancelled:', JSON.stringify(cancelResult, null, 2));
                } catch (error) {
                    console.log('❌ Order cancellation failed:', error.message);
                }
                console.log('');
            }
            
        } catch (error) {
            console.log('❌ Failed to get live orders:', error.message);
        }
        
        // Step 6: Check recent executions
        console.log('📊 Checking recent executions...');
        try {
            const executions = await orderClient.getExecutions();
            console.log(`💰 Found ${executions.length} recent executions:`);
            
            executions.slice(0, 5).forEach((execution, index) => {
                console.log(`  ${index + 1}. ${execution.symbol || 'N/A'}`);
                console.log(`     Side: ${execution.side}, Quantity: ${execution.shares}`);
                console.log(`     Price: $${execution.price}, Time: ${execution.execution_time}`);
                console.log('');
            });
            
        } catch (error) {
            console.log('❌ Failed to get executions:', error.message);
        }
        
        console.log('🎉 Order management example completed!');
        console.log('');
        console.log('⚠️  IMPORTANT REMINDERS:');
        console.log('   • This example uses PAPER TRADING - no real money involved');
        console.log('   • Always test thoroughly before using with live accounts');
        console.log('   • Be aware of market hours and order behavior');
        console.log('   • Monitor your positions and risk management');
        
    } catch (error) {
        console.error('❌ Error in order management example:');
        
        if (error instanceof AuthenticationError) {
            console.error('🔐 Authentication Error:', error.message);
            console.error('   Please log in to IB Gateway with paper trading account');
        } else if (error instanceof InvalidSymbolError) {
            console.error('📈 Invalid Symbol Error:', error.message);
        } else {
            console.error('💥 Unexpected Error:', error.message);
            if (error.stack) {
                console.error('Stack trace:', error.stack);
            }
        }
    }
}

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
    console.error('Unhandled Rejection at:', promise, 'reason:', reason);
    process.exit(1);
});

// Run the example
orderManagementExample().catch(console.error);
