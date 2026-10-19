# Demand Forecasting & Inventory Reorder Methodology

This document outlines the machine learning algorithms, statistical validation procedures, and classical supply-chain inventory formulas implemented in the Intelligent Inventory & Demand Forecasting System.

---

## 1. Data Ingestion & Preprocessing

### 1.1 Temporal Normalization & Zero-Filling
A common flaw in inventory data science is ignoring days with zero sales. If a store has no transactions on Tuesday, relational or document databases typically have no records for that date. Treating absent dates as missing data instead of zero demand severely biases mean demand upward.

Our preprocessing pipeline (`ForecastingService.get_product_daily_series`):
1. Aggregates all transaction quantities for each calendar date.
2. Constructs a continuous date range from $T_{min}$ to $T_{max}$ using pandas `date_range(..., freq='D')`.
3. Reindexes the daily series and explicitly zero-fills absent days:
   $$\text{Quantity}(t) = 0 \quad \forall t \notin \text{Transactions}$$

---

## 2. Feature Engineering

To model serial autocorrelation and weekly seasonality without external regressors, the following feature set is computed:

| Feature Name | Formulation | Business Rationale |
| :--- | :--- | :--- |
| `lag_1` | $y_{t-1}$ | Captures immediate momentum and previous-day stockout effects. |
| `lag_7` | $y_{t-7}$ | Captures weekly cyclicality (e.g. Saturday sales predictive of next Saturday). |
| `lag_14` | $y_{t-14}$ | Bi-weekly baseline anchor. |
| `rolling_mean_7` | $\frac{1}{7} \sum_{i=1}^7 y_{t-i}$ | Smoothed 7-day trailing velocity. |
| `rolling_std_7` | $\sigma(y_{t-7:t-1})$ | Trailing volatility and variance indicator. |
| `rolling_mean_14` | $\frac{1}{14} \sum_{i=1}^{14} y_{t-i}$ | Trailing bi-weekly baseline. |
| `day_of_week` | $\text{DayOfWeek}(t) \in [0, 6]$ | Categorical weekday identifier. |
| `is_weekend` | $\mathbb{I}(\text{DayOfWeek}(t) \in [4, 5, 6])$ | Indicator flag for peak retail weekend trading. |

---

## 3. Model Architecture & Validation

### 3.1 Time-Aware Validation Split
Cross-validation with random shuffling introduces lookahead bias in time-series forecasting. We enforce a **chronological split**:
- **Training Set:** The initial 80% of historical calendar days.
- **Hold-out Test Set:** The most recent 20% of historical calendar days.

### 3.2 Competing Models

1. **Baseline Model (Naive 7-Day Lag):**
   $$\hat{y}_{t}^{\text{base}} = y_{t-7}$$
   In retail goods, demand from the same weekday in the previous week serves as a strong, realistic benchmark that machine learning models must beat to justify their complexity.

2. **Machine Learning Model (Random Forest Regressor):**
   - Implemented via `sklearn.ensemble.RandomForestRegressor`.
   - Hyperparameters: `n_estimators=60, max_depth=6, min_samples_split=4, random_state=42`.
   - Generates non-linear splits capturing interacting day-of-week and rolling momentum features.

### 3.3 Evaluation Metrics
Models are evaluated on the held-out test split using:
- **Mean Absolute Error (MAE):**
  $$\text{MAE} = \frac{1}{N} \sum_{t=1}^N |y_t - \hat{y}_t|$$
- **Root Mean Squared Error (RMSE):**
  $$\text{RMSE} = \sqrt{\frac{1}{N} \sum_{t=1}^N (y_t - \hat{y}_t)^2}$$
- **Mean Absolute Percentage Error (MAPE):**
  $$\text{MAPE} = \frac{1}{|T_{\text{nonzero}}|} \sum_{t \in T_{\text{nonzero}}} \left| \frac{y_t - \hat{y}_t}{y_t} \right| \times 100\%$$

---

## 4. Sparse Data Fallback Strategy

If a product has fewer than **14 historical daily points**, machine learning regression is statistically prone to severe overfitting.

In this scenario:
- The system flags `is_fallback: true`.
- Sets an explicit, user-visible fallback reason:
  `"Insufficient historical sales data: Product has N daily observations (< 14 days required). 7-day Simple Moving Average baseline applied."`
- Never invents synthetic model accuracy metrics.

---

## 5. Classical Supply-Chain Inventory Formulas

Predicted demand alone does not tell an inventory manager how much to order. The system calculates reorder triggers using the following classical formulas:

### 5.1 Lead Time Demand ($LTD$)
The expected units consumed while awaiting an order from the supplier:
$$LTD = \bar{d} \times L$$
where $\bar{d}$ is average daily demand and $L$ is supplier lead time in days.

### 5.2 Safety Stock ($SS$)
To absorb both demand surges and supplier transit delays, safety stock is calculated incorporating both daily demand variance ($\sigma_d$) and lead time variance ($\sigma_L$):
$$SS = Z \times \sqrt{L \cdot \sigma_d^2 + \bar{d}^2 \cdot \sigma_L^2}$$
where $Z$ is the standard normal distribution quantile corresponding to the target Cycle Service Level (CSL):
- $Z = 1.65$ corresponds to a 95% service level.
- $Z = 2.33$ corresponds to a 99% service level.

### 5.3 Reorder Point ($ROP$)
The inventory threshold that triggers replenishment:
$$ROP = LTD + SS = (\bar{d} \times L) + SS$$

### 5.4 Economic Order Quantity ($EOQ$)
The optimal batch order quantity minimizing holding and ordering costs:
$$EOQ = \sqrt{\frac{2 \times D_{\text{annual}} \times S}{H}}$$
where:
- $D_{\text{annual}} = \bar{d} \times 365$ (Annual demand units)
- $S = \text{Fixed ordering cost per purchase order}$ (default \$50.00)
- $H = \text{Annual unit holding cost} = \text{cost\_price} \times \text{holding\_rate}$

### 5.5 Recommended Reorder Quantity ($ROQ$)
$$\text{ROQ} = \begin{cases} \max(EOQ, ROP - S_{\text{current}} + SS) & \text{if } S_{\text{current}} \le ROP \\ 0 & \text{if } S_{\text{current}} > ROP \end{cases}$$

### 5.6 Days Until Stockout
$$\text{Days Until Stockout} = \frac{S_{\text{current}}}{\bar{d}}$$
- **CRITICAL Urgency:** Triggered when $S_{\text{current}} \le SS$ or Days Until Stockout $\le L$ (stockout expected during transit).
- **WARNING Urgency:** Triggered when $S_{\text{current}} \le ROP$.
- **OPTIMAL:** Triggered when $S_{\text{current}} > ROP$.
