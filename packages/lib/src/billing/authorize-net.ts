/**
 * Authorize.Net API Integration Service
 * 
 * This service provides a TypeScript interface to Authorize.Net's payment gateway.
 * It handles customer profiles, payment profiles, and transaction processing.
 * 
 * IMPORTANT: Never log or store full card numbers, CVV, or bank account numbers.
 * Only tokenized references (profile IDs) should be persisted.
 */

// Types for Authorize.Net API
export interface AuthorizeNetConfig {
  apiLoginId: string;
  transactionKey: string;
  environment: 'sandbox' | 'production';
}

export interface CreateCustomerProfileRequest {
  email: string;
  description?: string;
  merchantCustomerId: string; // Our member ID
}

export interface CreateCustomerProfileResponse {
  success: boolean;
  customerProfileId?: string;
  customerPaymentProfileIds?: string[];
  errorCode?: string;
  errorMessage?: string;
}

export interface CreditCardPaymentMethod {
  type: 'credit_card';
  cardNumber: string;
  expirationDate: string; // YYYY-MM format
  cardCode?: string; // CVV
}

export interface BankAccountPaymentMethod {
  type: 'bank_account';
  accountType: 'checking' | 'savings' | 'businessChecking';
  routingNumber: string;
  accountNumber: string;
  nameOnAccount: string;
  bankName?: string;
}

export type PaymentMethod = CreditCardPaymentMethod | BankAccountPaymentMethod;

export interface BillingAddress {
  firstName: string;
  lastName: string;
  address?: string;
  city?: string;
  state?: string;
  zip?: string;
  country?: string;
  phoneNumber?: string;
}

export interface CreatePaymentProfileRequest {
  customerProfileId: string;
  paymentMethod: PaymentMethod;
  billingAddress?: BillingAddress;
  defaultPaymentProfile?: boolean;
}

export interface CreatePaymentProfileResponse {
  success: boolean;
  paymentProfileId?: string;
  validationResponse?: {
    authCode?: string;
    avsResultCode?: string;
    cvvResultCode?: string;
  };
  errorCode?: string;
  errorMessage?: string;
}

export interface ChargeProfileRequest {
  customerProfileId: string;
  paymentProfileId: string;
  amount: number;
  invoiceNumber?: string;
  description?: string;
  orderId?: string;
}

export interface ChargeProfileResponse {
  success: boolean;
  transactionId?: string;
  authCode?: string;
  responseCode?: '1' | '2' | '3' | '4'; // 1=Approved, 2=Declined, 3=Error, 4=Held
  responseReasonCode?: string;
  responseReasonText?: string;
  avsResultCode?: string;
  cvvResultCode?: string;
  errorCode?: string;
  errorMessage?: string;
}

export interface RefundRequest {
  transactionId: string;
  amount: number;
  customerProfileId?: string;
  paymentProfileId?: string;
  cardNumber?: string; // Last 4 digits for card refunds
}

export interface RefundResponse {
  success: boolean;
  transactionId?: string;
  responseCode?: string;
  errorCode?: string;
  errorMessage?: string;
}

export interface GetPaymentProfileResponse {
  success: boolean;
  paymentProfile?: {
    customerPaymentProfileId: string;
    payment: {
      creditCard?: {
        cardNumber: string; // Masked, e.g., "XXXX1234"
        expirationDate: string;
        cardType?: string;
      };
      bankAccount?: {
        accountType: string;
        routingNumber: string; // Masked
        accountNumber: string; // Masked
        nameOnAccount: string;
        bankName?: string;
      };
    };
    billTo?: BillingAddress;
  };
  errorCode?: string;
  errorMessage?: string;
}

/**
 * Authorize.Net API Client
 */
export class AuthorizeNetService {
  private apiLoginId: string;
  private transactionKey: string;
  private apiEndpoint: string;

  constructor(config: AuthorizeNetConfig) {
    this.apiLoginId = config.apiLoginId;
    this.transactionKey = config.transactionKey;
    this.apiEndpoint = config.environment === 'production'
      ? 'https://api.authorize.net/xml/v1/request.api'
      : 'https://apitest.authorize.net/xml/v1/request.api';
  }

  /**
   * Make an API request to Authorize.Net
   */
  private async makeRequest<T>(requestBody: Record<string, unknown>): Promise<T> {
    const response = await fetch(this.apiEndpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody),
    });

    const text = await response.text();
    // Remove BOM if present
    const cleanText = text.replace(/^\uFEFF/, '');
    return JSON.parse(cleanText) as T;
  }

  /**
   * Get merchant authentication object
   */
  private getMerchantAuth() {
    return {
      name: this.apiLoginId,
      transactionKey: this.transactionKey,
    };
  }

  /**
   * Create a customer profile in Authorize.Net
   */
  async createCustomerProfile(
    request: CreateCustomerProfileRequest
  ): Promise<CreateCustomerProfileResponse> {
    try {
      const response = await this.makeRequest<{
        messages: { resultCode: string; message: { code: string; text: string }[] };
        customerProfileId?: string;
        customerPaymentProfileIdList?: string[];
      }>({
        createCustomerProfileRequest: {
          merchantAuthentication: this.getMerchantAuth(),
          profile: {
            merchantCustomerId: request.merchantCustomerId,
            description: request.description || '',
            email: request.email,
          },
        },
      });

      if (response.messages.resultCode === 'Ok') {
        return {
          success: true,
          customerProfileId: response.customerProfileId,
          customerPaymentProfileIds: response.customerPaymentProfileIdList,
        };
      }

      const error = response.messages.message[0];
      return {
        success: false,
        errorCode: error?.code,
        errorMessage: error?.text,
      };
    } catch (error) {
      return {
        success: false,
        errorCode: 'NETWORK_ERROR',
        errorMessage: error instanceof Error ? error.message : 'Network error',
      };
    }
  }

  /**
   * Create a payment profile for an existing customer
   */
  async createPaymentProfile(
    request: CreatePaymentProfileRequest
  ): Promise<CreatePaymentProfileResponse> {
    try {
      let payment: Record<string, unknown>;

      if (request.paymentMethod.type === 'credit_card') {
        payment = {
          creditCard: {
            cardNumber: request.paymentMethod.cardNumber,
            expirationDate: request.paymentMethod.expirationDate,
            cardCode: request.paymentMethod.cardCode,
          },
        };
      } else {
        payment = {
          bankAccount: {
            accountType: request.paymentMethod.accountType,
            routingNumber: request.paymentMethod.routingNumber,
            accountNumber: request.paymentMethod.accountNumber,
            nameOnAccount: request.paymentMethod.nameOnAccount,
            bankName: request.paymentMethod.bankName,
          },
        };
      }

      const response = await this.makeRequest<{
        messages: { resultCode: string; message: { code: string; text: string }[] };
        customerPaymentProfileId?: string;
        validationDirectResponse?: string;
      }>({
        createCustomerPaymentProfileRequest: {
          merchantAuthentication: this.getMerchantAuth(),
          customerProfileId: request.customerProfileId,
          paymentProfile: {
            billTo: request.billingAddress ? {
              firstName: request.billingAddress.firstName,
              lastName: request.billingAddress.lastName,
              address: request.billingAddress.address,
              city: request.billingAddress.city,
              state: request.billingAddress.state,
              zip: request.billingAddress.zip,
              country: request.billingAddress.country || 'US',
              phoneNumber: request.billingAddress.phoneNumber,
            } : undefined,
            payment,
            defaultPaymentProfile: request.defaultPaymentProfile,
          },
          validationMode: 'liveMode', // or 'testMode' for sandbox testing
        },
      });

      if (response.messages.resultCode === 'Ok') {
        return {
          success: true,
          paymentProfileId: response.customerPaymentProfileId,
        };
      }

      const error = response.messages.message[0];
      return {
        success: false,
        errorCode: error?.code,
        errorMessage: error?.text,
      };
    } catch (error) {
      return {
        success: false,
        errorCode: 'NETWORK_ERROR',
        errorMessage: error instanceof Error ? error.message : 'Network error',
      };
    }
  }

  /**
   * Charge a customer profile
   */
  async chargeCustomerProfile(
    request: ChargeProfileRequest
  ): Promise<ChargeProfileResponse> {
    try {
      const response = await this.makeRequest<{
        messages: { resultCode: string; message: { code: string; text: string }[] };
        transactionResponse?: {
          transId: string;
          responseCode: '1' | '2' | '3' | '4';
          authCode?: string;
          avsResultCode?: string;
          cvvResultCode?: string;
          messages?: { code: string; description: string }[];
          errors?: { errorCode: string; errorText: string }[];
        };
      }>({
        createTransactionRequest: {
          merchantAuthentication: this.getMerchantAuth(),
          transactionRequest: {
            transactionType: 'authCaptureTransaction',
            amount: request.amount.toFixed(2),
            profile: {
              customerProfileId: request.customerProfileId,
              paymentProfile: {
                paymentProfileId: request.paymentProfileId,
              },
            },
            order: {
              invoiceNumber: request.invoiceNumber,
              description: request.description,
            },
          },
        },
      });

      const txnResponse = response.transactionResponse;

      if (response.messages.resultCode === 'Ok' && txnResponse?.responseCode === '1') {
        return {
          success: true,
          transactionId: txnResponse.transId,
          authCode: txnResponse.authCode,
          responseCode: txnResponse.responseCode,
          avsResultCode: txnResponse.avsResultCode,
          cvvResultCode: txnResponse.cvvResultCode,
        };
      }

      const error = txnResponse?.errors?.[0] || response.messages.message[0];
      return {
        success: false,
        transactionId: txnResponse?.transId,
        responseCode: txnResponse?.responseCode,
        errorCode: 'errorCode' in error ? error.errorCode : error?.code,
        errorMessage: 'errorText' in error ? error.errorText : error?.text,
      };
    } catch (error) {
      return {
        success: false,
        errorCode: 'NETWORK_ERROR',
        errorMessage: error instanceof Error ? error.message : 'Network error',
      };
    }
  }

  /**
   * Refund a transaction
   */
  async refundTransaction(request: RefundRequest): Promise<RefundResponse> {
    try {
      const transactionRequest: Record<string, unknown> = {
        transactionType: 'refundTransaction',
        amount: request.amount.toFixed(2),
        refTransId: request.transactionId,
      };

      // Add payment info if using profile
      if (request.customerProfileId && request.paymentProfileId) {
        transactionRequest.profile = {
          customerProfileId: request.customerProfileId,
          paymentProfile: {
            paymentProfileId: request.paymentProfileId,
          },
        };
      } else if (request.cardNumber) {
        // For card refunds without profile, need last 4 digits
        transactionRequest.payment = {
          creditCard: {
            cardNumber: request.cardNumber,
            expirationDate: 'XXXX', // Not validated for refunds
          },
        };
      }

      const response = await this.makeRequest<{
        messages: { resultCode: string; message: { code: string; text: string }[] };
        transactionResponse?: {
          transId: string;
          responseCode: string;
          errors?: { errorCode: string; errorText: string }[];
        };
      }>({
        createTransactionRequest: {
          merchantAuthentication: this.getMerchantAuth(),
          transactionRequest,
        },
      });

      const txnResponse = response.transactionResponse;

      if (response.messages.resultCode === 'Ok' && txnResponse?.responseCode === '1') {
        return {
          success: true,
          transactionId: txnResponse.transId,
          responseCode: txnResponse.responseCode,
        };
      }

      const error = txnResponse?.errors?.[0] || response.messages.message[0];
      return {
        success: false,
        transactionId: txnResponse?.transId,
        responseCode: txnResponse?.responseCode,
        errorCode: 'errorCode' in error ? error.errorCode : error?.code,
        errorMessage: 'errorText' in error ? error.errorText : error?.text,
      };
    } catch (error) {
      return {
        success: false,
        errorCode: 'NETWORK_ERROR',
        errorMessage: error instanceof Error ? error.message : 'Network error',
      };
    }
  }

  /**
   * Get a payment profile
   */
  async getPaymentProfile(
    customerProfileId: string,
    paymentProfileId: string
  ): Promise<GetPaymentProfileResponse> {
    try {
      const response = await this.makeRequest<{
        messages: { resultCode: string; message: { code: string; text: string }[] };
        paymentProfile?: {
          customerPaymentProfileId: string;
          payment: {
            creditCard?: {
              cardNumber: string;
              expirationDate: string;
              cardType?: string;
            };
            bankAccount?: {
              accountType: string;
              routingNumber: string;
              accountNumber: string;
              nameOnAccount: string;
              bankName?: string;
            };
          };
          billTo?: {
            firstName: string;
            lastName: string;
            address?: string;
            city?: string;
            state?: string;
            zip?: string;
            country?: string;
            phoneNumber?: string;
          };
        };
      }>({
        getCustomerPaymentProfileRequest: {
          merchantAuthentication: this.getMerchantAuth(),
          customerProfileId,
          customerPaymentProfileId: paymentProfileId,
        },
      });

      if (response.messages.resultCode === 'Ok' && response.paymentProfile) {
        return {
          success: true,
          paymentProfile: {
            customerPaymentProfileId: response.paymentProfile.customerPaymentProfileId,
            payment: response.paymentProfile.payment,
            billTo: response.paymentProfile.billTo,
          },
        };
      }

      const error = response.messages.message[0];
      return {
        success: false,
        errorCode: error?.code,
        errorMessage: error?.text,
      };
    } catch (error) {
      return {
        success: false,
        errorCode: 'NETWORK_ERROR',
        errorMessage: error instanceof Error ? error.message : 'Network error',
      };
    }
  }

  /**
   * Delete a payment profile
   */
  async deletePaymentProfile(
    customerProfileId: string,
    paymentProfileId: string
  ): Promise<{ success: boolean; errorCode?: string; errorMessage?: string }> {
    try {
      const response = await this.makeRequest<{
        messages: { resultCode: string; message: { code: string; text: string }[] };
      }>({
        deleteCustomerPaymentProfileRequest: {
          merchantAuthentication: this.getMerchantAuth(),
          customerProfileId,
          customerPaymentProfileId: paymentProfileId,
        },
      });

      if (response.messages.resultCode === 'Ok') {
        return { success: true };
      }

      const error = response.messages.message[0];
      return {
        success: false,
        errorCode: error?.code,
        errorMessage: error?.text,
      };
    } catch (error) {
      return {
        success: false,
        errorCode: 'NETWORK_ERROR',
        errorMessage: error instanceof Error ? error.message : 'Network error',
      };
    }
  }

  /**
   * Void a transaction (before settlement)
   */
  async voidTransaction(
    transactionId: string
  ): Promise<{ success: boolean; transactionId?: string; errorCode?: string; errorMessage?: string }> {
    try {
      const response = await this.makeRequest<{
        messages: { resultCode: string; message: { code: string; text: string }[] };
        transactionResponse?: {
          transId: string;
          responseCode: string;
          errors?: { errorCode: string; errorText: string }[];
        };
      }>({
        createTransactionRequest: {
          merchantAuthentication: this.getMerchantAuth(),
          transactionRequest: {
            transactionType: 'voidTransaction',
            refTransId: transactionId,
          },
        },
      });

      const txnResponse = response.transactionResponse;

      if (response.messages.resultCode === 'Ok' && txnResponse?.responseCode === '1') {
        return {
          success: true,
          transactionId: txnResponse.transId,
        };
      }

      const error = txnResponse?.errors?.[0] || response.messages.message[0];
      return {
        success: false,
        transactionId: txnResponse?.transId,
        errorCode: 'errorCode' in error ? error.errorCode : error?.code,
        errorMessage: 'errorText' in error ? error.errorText : error?.text,
      };
    } catch (error) {
      return {
        success: false,
        errorCode: 'NETWORK_ERROR',
        errorMessage: error instanceof Error ? error.message : 'Network error',
      };
    }
  }
}

/**
 * Factory function to create AuthorizeNet service with environment config
 */
export function createAuthorizeNetService(): AuthorizeNetService {
  const apiLoginId = process.env.AUTHORIZE_NET_API_LOGIN_ID;
  const transactionKey = process.env.AUTHORIZE_NET_TRANSACTION_KEY;
  const environment = process.env.AUTHORIZE_NET_ENVIRONMENT as 'sandbox' | 'production';

  if (!apiLoginId || !transactionKey) {
    throw new Error('Authorize.Net credentials not configured');
  }

  return new AuthorizeNetService({
    apiLoginId,
    transactionKey,
    environment: environment || 'sandbox',
  });
}

/**
 * Helper to extract last 4 digits from card/account number
 */
export function maskNumber(fullNumber: string): string {
  return fullNumber.slice(-4);
}

/**
 * Helper to detect card type from number
 */
export function detectCardType(cardNumber: string): string {
  const firstDigit = cardNumber.charAt(0);
  const firstTwo = cardNumber.substring(0, 2);

  if (cardNumber.startsWith('4')) return 'Visa';
  if (['51', '52', '53', '54', '55'].includes(firstTwo) || 
      (parseInt(firstTwo) >= 22 && parseInt(firstTwo) <= 27)) return 'Mastercard';
  if (['34', '37'].includes(firstTwo)) return 'Amex';
  if (['60', '65'].includes(firstTwo) || cardNumber.startsWith('6011')) return 'Discover';
  
  return 'Unknown';
}
