'use client';

import { Card, CardContent, Button, Badge } from '@crm-eco/ui';
import { CreditCard, Building2, Trash2, Star, MoreVertical } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@crm-eco/ui';

interface PaymentProfile {
  id: string;
  paymentType: 'credit_card' | 'bank_account';
  lastFour: string;
  cardType?: string;
  expirationDate?: string;
  accountType?: string;
  bankName?: string;
  billingFirstName?: string;
  billingLastName?: string;
  isDefault: boolean;
  nickname?: string;
}

interface PaymentProfileCardProps {
  profile: PaymentProfile;
  onSetDefault?: (id: string) => void;
  onDelete?: (id: string) => void;
  isProcessing?: boolean;
}

export function PaymentProfileCard({
  profile,
  onSetDefault,
  onDelete,
  isProcessing,
}: PaymentProfileCardProps) {
  const isCard = profile.paymentType === 'credit_card';

  return (
    <Card className={`relative ${profile.isDefault ? 'ring-2 ring-blue-500' : ''}`}>
      <CardContent className="pt-6">
        <div className="flex items-start justify-between">
          <div className="flex items-start gap-4">
            <div
              className={`p-3 rounded-lg ${
                isCard ? 'bg-blue-100' : 'bg-green-100'
              }`}
            >
              {isCard ? (
                <CreditCard className="h-6 w-6 text-blue-600" />
              ) : (
                <Building2 className="h-6 w-6 text-green-600" />
              )}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <p className="font-semibold text-slate-900">
                  {profile.nickname ||
                    (isCard
                      ? profile.cardType || 'Card'
                      : profile.bankName || 'Bank Account')}
                </p>
                {profile.isDefault && (
                  <Badge variant="default" className="text-xs">
                    <Star className="h-3 w-3 mr-1" />
                    Default
                  </Badge>
                )}
              </div>
              <p className="text-slate-600">•••• {profile.lastFour}</p>
              {isCard && profile.expirationDate && (
                <p className="text-sm text-slate-500">
                  Expires {profile.expirationDate}
                </p>
              )}
              {!isCard && profile.accountType && (
                <p className="text-sm text-slate-500 capitalize">
                  {profile.accountType} Account
                </p>
              )}
              {profile.billingFirstName && (
                <p className="text-xs text-slate-400 mt-1">
                  {profile.billingFirstName} {profile.billingLastName}
                </p>
              )}
            </div>
          </div>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" disabled={isProcessing}>
                <MoreVertical className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {!profile.isDefault && onSetDefault && (
                <DropdownMenuItem onClick={() => onSetDefault(profile.id)}>
                  <Star className="h-4 w-4 mr-2" />
                  Set as Default
                </DropdownMenuItem>
              )}
              {onDelete && (
                <DropdownMenuItem
                  onClick={() => onDelete(profile.id)}
                  className="text-red-600"
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  Delete
                </DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </CardContent>
    </Card>
  );
}
