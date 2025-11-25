import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, Dimensions, TouchableOpacity, RefreshControl } from 'react-native';
import { LineChart, BarChart, PieChart } from 'react-native-chart-kit';
import api from '../api';

const FinancialDashboardScreen = ({ route, navigation }) => {
  const [reports, setReports] = useState([]);
  const [currentReport, setCurrentReport] = useState(null);
  const [loading, setLoading] = useState(false);
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());

  useEffect(() => {
    loadReports();
    generateReport();
  }, [selectedMonth, selectedYear]);

  const loadReports = async () => {
    try {
      const userId = route.params?.userId || 'me';
      const res = await api.get(`/ai/financial-report/${userId}`);
      setReports(res.data.reports || []);
    } catch (error) {
      console.error('Load reports error:', error);
    }
  };

  const generateReport = async () => {
    setLoading(true);
    try {
      const res = await api.post('/ai/financial-assistant', {
        month: selectedMonth,
        year: selectedYear
      });
      setCurrentReport(res.data.report);
    } catch (error) {
      console.error('Generate report error:', error);
    } finally {
      setLoading(false);
    }
  };

  const screenWidth = Dimensions.get('window').width;

  const renderIncomeExpenseChart = () => {
    if (!currentReport) return null;

    const data = {
      labels: ['Income', 'Expenses', 'Net'],
      datasets: [{
        data: [
          currentReport.income.total,
          currentReport.expenses.total,
          currentReport.netBalance
        ]
      }]
    };

    return (
      <View style={styles.chartContainer}>
        <Text style={styles.chartTitle}>Income vs Expenses</Text>
        <BarChart
          data={data}
          width={screenWidth - 40}
          height={220}
          chartConfig={{
            backgroundColor: '#ffffff',
            backgroundGradientFrom: '#4CAF50',
            backgroundGradientTo: '#81C784',
            decimalPlaces: 0,
            color: (opacity = 1) => `rgba(255, 255, 255, ${opacity})`,
            style: { borderRadius: 16 }
          }}
          style={styles.chart}
        />
      </View>
    );
  };

  const renderCategoryBreakdown = () => {
    if (!currentReport) return null;

    const incomeData = [
      { name: 'Gifts', population: currentReport.income.liveStreamGifts, color: '#FF6384', legendFontColor: '#333' },
      { name: 'Boost', population: currentReport.income.boostRevenue, color: '#36A2EB', legendFontColor: '#333' },
      { name: 'Premium', population: currentReport.income.premiumContent, color: '#FFCE56', legendFontColor: '#333' },
      { name: 'Other', population: currentReport.income.other, color: '#4BC0C0', legendFontColor: '#333' }
    ].filter(item => item.population > 0);

    if (incomeData.length === 0) return null;

    return (
      <View style={styles.chartContainer}>
        <Text style={styles.chartTitle}>Income Breakdown</Text>
        <PieChart
          data={incomeData}
          width={screenWidth - 40}
          height={220}
          chartConfig={{
            color: (opacity = 1) => `rgba(0, 0, 0, ${opacity})`
          }}
          accessor="population"
          backgroundColor="transparent"
          paddingLeft="15"
          absolute
        />
      </View>
    );
  };

  const renderInsights = () => {
    if (!currentReport?.insights) return null;

    return (
      <View style={styles.insightsContainer}>
        <Text style={styles.sectionTitle}>Financial Insights</Text>
        
        <View style={styles.insightCard}>
          <Text style={styles.insightLabel}>Top Income Source</Text>
          <Text style={styles.insightValue}>{currentReport.insights.topIncomeSource}</Text>
        </View>

        <View style={styles.insightCard}>
          <Text style={styles.insightLabel}>Savings Rate</Text>
          <Text style={[styles.insightValue, { color: currentReport.insights.savingsRate > 20 ? '#4CAF50' : '#FF5722' }]}>
            {currentReport.insights.savingsRate}%
          </Text>
        </View>

        <View style={styles.insightCard}>
          <Text style={styles.insightLabel}>Growth Rate</Text>
          <Text style={[styles.insightValue, { color: currentReport.insights.growthRate >= 0 ? '#4CAF50' : '#FF5722' }]}>
            {currentReport.insights.growthRate}%
          </Text>
        </View>

        {currentReport.insights.recommendations && currentReport.insights.recommendations.length > 0 && (
          <View style={styles.recommendationsContainer}>
            <Text style={styles.recommendationTitle}>💡 Recommendations:</Text>
            {currentReport.insights.recommendations.map((rec, index) => (
              <Text key={index} style={styles.recommendationText}>• {rec}</Text>
            ))}
          </View>
        )}
      </View>
    );
  };

  const renderMonthSelector = () => {
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    
    return (
      <View style={styles.monthSelector}>
        <TouchableOpacity onPress={() => {
          if (selectedMonth === 1) {
            setSelectedMonth(12);
            setSelectedYear(selectedYear - 1);
          } else {
            setSelectedMonth(selectedMonth - 1);
          }
        }}>
          <Text style={styles.navButton}>◀</Text>
        </TouchableOpacity>
        
        <Text style={styles.selectedMonth}>
          {months[selectedMonth - 1]} {selectedYear}
        </Text>
        
        <TouchableOpacity onPress={() => {
          if (selectedMonth === 12) {
            setSelectedMonth(1);
            setSelectedYear(selectedYear + 1);
          } else {
            setSelectedMonth(selectedMonth + 1);
          }
        }}>
          <Text style={styles.navButton}>▶</Text>
        </TouchableOpacity>
      </View>
    );
  };

  return (
    <ScrollView 
      style={styles.container}
      refreshControl={<RefreshControl refreshing={loading} onRefresh={() => generateReport()} />}
    >
      <View style={styles.header}>
        <Text style={styles.title}>Financial Dashboard</Text>
        {renderMonthSelector()}
      </View>

      {currentReport && (
        <>
          <View style={styles.summaryContainer}>
            <View style={[styles.summaryCard, { backgroundColor: '#4CAF50' }]}>
              <Text style={styles.summaryLabel}>Total Income</Text>
              <Text style={styles.summaryValue}>{currentReport.income.total.toLocaleString()} coins</Text>
            </View>
            
            <View style={[styles.summaryCard, { backgroundColor: '#FF5722' }]}>
              <Text style={styles.summaryLabel}>Total Expenses</Text>
              <Text style={styles.summaryValue}>{currentReport.expenses.total.toLocaleString()} coins</Text>
            </View>
            
            <View style={[styles.summaryCard, { backgroundColor: currentReport.netBalance >= 0 ? '#2196F3' : '#F44336' }]}>
              <Text style={styles.summaryLabel}>Net Balance</Text>
              <Text style={styles.summaryValue}>{currentReport.netBalance.toLocaleString()} coins</Text>
            </View>
          </View>

          {renderIncomeExpenseChart()}
          {renderCategoryBreakdown()}
          {renderInsights()}
        </>
      )}

      {!currentReport && !loading && (
        <View style={styles.emptyState}>
          <Text style={styles.emptyText}>No financial data for this month</Text>
          <TouchableOpacity style={styles.generateButton} onPress={generateReport}>
            <Text style={styles.generateButtonText}>Generate Report</Text>
          </TouchableOpacity>
        </View>
      )}
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5'
  },
  header: {
    backgroundColor: '#fff',
    padding: 20,
    elevation: 2
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 15
  },
  monthSelector: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#f0f0f0',
    padding: 10,
    borderRadius: 8
  },
  navButton: {
    fontSize: 24,
    color: '#2196F3',
    paddingHorizontal: 15
  },
  selectedMonth: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333'
  },
  summaryContainer: {
    padding: 15
  },
  summaryCard: {
    padding: 20,
    borderRadius: 12,
    marginBottom: 10,
    elevation: 3
  },
  summaryLabel: {
    fontSize: 14,
    color: '#fff',
    marginBottom: 5
  },
  summaryValue: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#fff'
  },
  chartContainer: {
    backgroundColor: '#fff',
    margin: 15,
    padding: 15,
    borderRadius: 12,
    elevation: 2
  },
  chartTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 10
  },
  chart: {
    borderRadius: 16
  },
  insightsContainer: {
    backgroundColor: '#fff',
    margin: 15,
    padding: 20,
    borderRadius: 12,
    elevation: 2
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 15
  },
  insightCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#eee'
  },
  insightLabel: {
    fontSize: 16,
    color: '#666'
  },
  insightValue: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333'
  },
  recommendationsContainer: {
    marginTop: 20,
    padding: 15,
    backgroundColor: '#FFF9C4',
    borderRadius: 8
  },
  recommendationTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 10
  },
  recommendationText: {
    fontSize: 14,
    color: '#666',
    marginBottom: 5,
    lineHeight: 20
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 40
  },
  emptyText: {
    fontSize: 16,
    color: '#999',
    marginBottom: 20
  },
  generateButton: {
    backgroundColor: '#2196F3',
    paddingVertical: 12,
    paddingHorizontal: 30,
    borderRadius: 8
  },
  generateButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold'
  }
});

export default FinancialDashboardScreen;
