/**
 * Bracket orders example for the IB Client Portal SDK
 * 
 * This example focuses specifically on bracket orders, showing:
 * 1. Market bracket orders
 * 2. Limit bracket orders
 * 3. Different profit/loss scenarios
 * 4. Monitoring bracket order execution
 */

import { 
    createOrderClient, 
    createMarketDataClient,
    OrderTypes, 
    OrderSides, 
    TimeInForce 
} from '../src/index.js';

async function bracketOrdersExample() {
    console.log('🎯 IB Client Portal SDK - Bracket Orders Example\n');
    
    // Create clients
    const orderClient = createOrderClient();
    const marketClient = createMarketDataClient();
    
    try {
        // Check authentication
        const authStatus = await orderClient.client.getAuthStatus();
        if (!authStatus.authenticated) {
            console.log('⚠️  Please authenticate with IB Gateway first (paper trading account)');
            return;
        }
        
        console.log('✅ Authenticated with paper trading account\n');
        
        // Get current price for reference
        const symbol = 'AAPL';
        console.log(`📊 Getting current price for ${symbol}...`);
        
        const priceData = await marketClient.getStockPrice(symbol);
        const currentPrice = priceData.lastPrice;
        
        if (!currentPrice) {
            console.log('❌ Could not get current price. Market may be closed.');
            return;
        }
        
        console.log(`💰 Current ${symbol} price: $${currentPrice}\n`);
        
        // Calculate bracket levels based on current price
        const quantity = 10;
        const profitTarget = currentPrice * 1.05; // 5% profit target
        const stopLoss = currentPrice * 0.95;     // 5% stop loss
        
        console.log(`🎯 Bracket levels:`);
        console.log(`   Profit Target: $${profitTarget.toFixed(2)} (+5%)`);
        console.log(`   Stop Loss: $${stopLoss.toFixed(2)} (-5%)\n`);
        
        // Example 1: Market Bracket Order
        console.log('1️⃣ Market Bracket Order');
        console.log('   Parent: Market order to buy immediately');
        console.log('   Children: Profit target (limit) + Stop loss (stop)');
        
        try {
            const marketBracket = await orderClient.placeBracketOrder(
                symbol,
                OrderSides.BUY,
                quantity,
                { 
                    orderType: OrderTypes.MARKET 
                },
                { 
                    price: profitTarget 
                },
                { 
                    price: stopLoss 
                },
                {
                    timeInForce: TimeInForce.DAY
                }
            );
            
            console.log('✅ Market bracket order placed successfully!');
            console.log('Response:', JSON.stringify(marketBracket, null, 2));
            
        } catch (error) {
            console.log('❌ Market bracket order failed:', error.message);
        }
        console.log('');
        
        // Example 2: Limit Bracket Order
        console.log('2️⃣ Limit Bracket Order');
        console.log('   Parent: Limit order to buy at specific price');
        console.log('   Children: Profit target + Stop loss (activated after parent fills)');
        
        const limitPrice = currentPrice * 0.99; // Try to buy 1% below current price
        console.log(`   Limit price: $${limitPrice.toFixed(2)} (-1% from current)`);
        
        try {
            const limitBracket = await orderClient.placeBracketOrder(
                symbol,
                OrderSides.BUY,
                quantity,
                { 
                    orderType: OrderTypes.LIMIT,
                    price: limitPrice
                },
                { 
                    price: profitTarget 
                },
                { 
                    price: stopLoss 
                },
                {
                    timeInForce: TimeInForce.GTC // Good till cancelled
                }
            );
            
            console.log('✅ Limit bracket order placed successfully!');
            console.log('Response:', JSON.stringify(limitBracket, null, 2));
            
        } catch (error) {
            console.log('❌ Limit bracket order failed:', error.message);
        }
        console.log('');
        
        // Example 3: Aggressive Bracket (Tighter Stops)
        console.log('3️⃣ Aggressive Bracket Order');
        console.log('   Tighter profit target and stop loss for quick scalping');
        
        const aggressiveProfitTarget = currentPrice * 1.02; // 2% profit
        const aggressiveStopLoss = currentPrice * 0.98;     // 2% stop loss
        
        console.log(`   Aggressive Profit Target: $${aggressiveProfitTarget.toFixed(2)} (+2%)`);
        console.log(`   Aggressive Stop Loss: $${aggressiveStopLoss.toFixed(2)} (-2%)`);
        
        try {
            const aggressiveBracket = await orderClient.placeBracketOrder(
                symbol,
                OrderSides.BUY,
                quantity,
                { 
                    orderType: OrderTypes.MARKET 
                },
                { 
                    price: aggressiveProfitTarget 
                },
                { 
                    price: aggressiveStopLoss 
                }
            );
            
            console.log('✅ Aggressive bracket order placed successfully!');
            console.log('Response:', JSON.stringify(aggressiveBracket, null, 2));
            
        } catch (error) {
            console.log('❌ Aggressive bracket order failed:', error.message);
        }
        console.log('');
        
        // Example 4: Conservative Bracket (Wider Stops)
        console.log('4️⃣ Conservative Bracket Order');
        console.log('   Wider profit target and stop loss for swing trading');
        
        const conservativeProfitTarget = currentPrice * 1.10; // 10% profit
        const conservativeStopLoss = currentPrice * 0.90;     // 10% stop loss
        
        console.log(`   Conservative Profit Target: $${conservativeProfitTarget.toFixed(2)} (+10%)`);
        console.log(`   Conservative Stop Loss: $${conservativeStopLoss.toFixed(2)} (-10%)`);
        
        try {
            const conservativeBracket = await orderClient.placeBracketOrder(
                symbol,
                OrderSides.BUY,
                quantity,
                { 
                    orderType: OrderTypes.LIMIT,
                    price: currentPrice * 0.98 // Buy 2% below current price
                },
                { 
                    price: conservativeProfitTarget 
                },
                { 
                    price: conservativeStopLoss 
                },
                {
                    timeInForce: TimeInForce.GTC
                }
            );
            
            console.log('✅ Conservative bracket order placed successfully!');
            console.log('Response:', JSON.stringify(conservativeBracket, null, 2));
            
        } catch (error) {
            console.log('❌ Conservative bracket order failed:', error.message);
        }
        console.log('');
        
        // Monitor the orders
        console.log('👀 Monitoring live orders...');
        try {
            const liveOrders = await orderClient.getLiveOrders();
            
            if (liveOrders.length > 0) {
                console.log(`📋 Found ${liveOrders.length} live orders:`);
                
                // Group orders by parent/child relationships if possible
                const parentOrders = liveOrders.filter(order => !order.parentId);
                const childOrders = liveOrders.filter(order => order.parentId);
                
                console.log(`   Parent orders: ${parentOrders.length}`);
                console.log(`   Child orders: ${childOrders.length}`);
                
                parentOrders.forEach((order, index) => {
                    console.log(`\\n   Parent Order ${index + 1}:`);
                    console.log(`     ID: ${order.orderId}`);
                    console.log(`     Symbol: ${order.ticker || symbol}`);
                    console.log(`     Type: ${order.orderType}, Side: ${order.side}`);
                    console.log(`     Quantity: ${order.totalSize}, Status: ${order.status}`);
                    console.log(`     Price: ${order.price || 'Market'}`);
                    
                    // Find related child orders
                    const relatedChildren = childOrders.filter(child => child.parentId === order.orderId);
                    if (relatedChildren.length > 0) {
                        console.log(`     Child Orders: ${relatedChildren.length}`);
                        relatedChildren.forEach((child, childIndex) => {
                            console.log(`       ${childIndex + 1}. ${child.orderType} ${child.side} @ ${child.price || child.auxPrice}`);
                        });
                    }
                });
            } else {
                console.log('📋 No live orders found');
            }
            
        } catch (error) {
            console.log('❌ Failed to get live orders:', error.message);
        }
        
        console.log('\\n🎉 Bracket orders example completed!');
        console.log('\\n💡 Bracket Order Tips:');
        console.log('   • Parent order must fill before child orders activate');
        console.log('   • Only one child order can fill (OCO - One Cancels Other)');
        console.log('   • Use appropriate profit/loss ratios (e.g., 2:1 reward:risk)');
        console.log('   • Consider market volatility when setting bracket levels');
        console.log('   • Monitor orders regularly, especially near market close');
        console.log('   • Paper trade first to understand behavior');
        
    } catch (error) {
        console.error('❌ Error in bracket orders example:', error.message);
        if (error.stack) {
            console.error('Stack trace:', error.stack);
        }
    }
}

// Run the example
bracketOrdersExample().catch(console.error);
