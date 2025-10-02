import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { 
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { 
  ShieldCheck, 
  Users, 
  AlertTriangle, 
  CheckCircle,
  Search,
  Filter,
  Download,
  RefreshCw
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

interface VerificationStats {
  totalUsers: number;
  basicUsers: number;
  paymentVerified: number;
  idVerified: number;
  premiumVerified: number;
  flaggedUsers: number;
  pendingReviews: number;
}

interface UserVerification {
  id: string;
  email: string;
  full_name: string;
  verification_tier: string;
  verification_score: number;
  address_verification_status: string;
  fraud_flags: number;
  created_at: string;
  last_verification_check: string;
}

export function VerificationAdminDashboard() {
  const [stats, setStats] = useState<VerificationStats | null>(null);
  const [users, setUsers] = useState<UserVerification[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterTier, setFilterTier] = useState<string>("all");

  useEffect(() => {
    loadStats();
    loadUsers();
  }, []);

  const loadStats = async () => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('verification_tier, fraud_flags, address_verification_status');

      if (error) throw error;

      const stats: VerificationStats = {
        totalUsers: data.length,
        basicUsers: data.filter(p => p.verification_tier === 'basic').length,
        paymentVerified: data.filter(p => p.verification_tier === 'payment_verified').length,
        idVerified: data.filter(p => p.verification_tier === 'id_verified').length,
        premiumVerified: data.filter(p => p.verification_tier === 'premium_verified').length,
        flaggedUsers: data.filter(p => (p.fraud_flags || 0) > 0).length,
        pendingReviews: data.filter(p => p.address_verification_status === 'requires_review').length,
      };

      setStats(stats);
    } catch (error) {
      console.error('Failed to load stats:', error);
    }
  };

  const loadUsers = async () => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select(`
          id,
          user_id,
          full_name,
          verification_tier,
          verification_score,
          address_verification_status,
          fraud_flags,
          created_at,
          last_verification_check,
          auth.users!inner(email)
        `)
        .order('created_at', { ascending: false })
        .limit(100);

      if (error) throw error;

      const usersWithEmail = data.map(user => ({
        ...user,
        email: user.auth?.users?.email || 'N/A'
      }));

      setUsers(usersWithEmail);
    } catch (error) {
      console.error('Failed to load users:', error);
    } finally {
      setLoading(false);
    }
  };

  const getTierBadge = (tier: string) => {
    const variants = {
      basic: 'secondary',
      payment_verified: 'default',
      id_verified: 'default',
      premium_verified: 'secondary',
    } as const;

    const colors = {
      basic: 'bg-gray-100 text-gray-800',
      payment_verified: 'bg-blue-100 text-blue-800',
      id_verified: 'bg-green-100 text-green-800',
      premium_verified: 'bg-yellow-100 text-yellow-800',
    };

    return (
      <Badge 
        variant={variants[tier as keyof typeof variants] || 'secondary'}
        className={colors[tier as keyof typeof colors] || 'bg-gray-100 text-gray-800'}
      >
        {tier.replace('_', ' ')}
      </Badge>
    );
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'verified':
        return <CheckCircle className="h-4 w-4 text-green-600" />;
      case 'requires_review':
        return <AlertTriangle className="h-4 w-4 text-yellow-600" />;
      case 'mismatch':
        return <AlertTriangle className="h-4 w-4 text-red-600" />;
      default:
        return <AlertTriangle className="h-4 w-4 text-gray-400" />;
    }
  };

  const filteredUsers = users.filter(user => {
    const matchesSearch = user.full_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         user.email?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesTier = filterTier === 'all' || user.verification_tier === filterTier;
    return matchesSearch && matchesTier;
  });

  const exportData = () => {
    const csvContent = [
      ['Name', 'Email', 'Tier', 'Score', 'Address Status', 'Fraud Flags', 'Created'],
      ...filteredUsers.map(user => [
        user.full_name || 'N/A',
        user.email || 'N/A',
        user.verification_tier,
        user.verification_score?.toString() || '0',
        user.address_verification_status || 'pending',
        user.fraud_flags?.toString() || '0',
        new Date(user.created_at).toLocaleDateString()
      ])
    ].map(row => row.join(',')).join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `verification-report-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <RefreshCw className="h-6 w-6 animate-spin" />
        <span className="ml-2">Loading verification data...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Stats Cards */}
      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Users</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.totalUsers}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Basic</CardTitle>
              <ShieldCheck className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.basicUsers}</div>
              <p className="text-xs text-muted-foreground">
                {Math.round((stats.basicUsers / stats.totalUsers) * 100)}% of total
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Payment Verified</CardTitle>
              <CheckCircle className="h-4 w-4 text-green-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.paymentVerified}</div>
              <p className="text-xs text-muted-foreground">
                {Math.round((stats.paymentVerified / stats.totalUsers) * 100)}% of total
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">ID Verified</CardTitle>
              <ShieldCheck className="h-4 w-4 text-blue-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.idVerified + stats.premiumVerified}</div>
              <p className="text-xs text-muted-foreground">
                {Math.round(((stats.idVerified + stats.premiumVerified) / stats.totalUsers) * 100)}% of total
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Flagged Users</CardTitle>
              <AlertTriangle className="h-4 w-4 text-red-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.flaggedUsers}</div>
              <p className="text-xs text-muted-foreground">
                {Math.round((stats.flaggedUsers / stats.totalUsers) * 100)}% of total
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Pending Reviews</CardTitle>
              <AlertTriangle className="h-4 w-4 text-yellow-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.pendingReviews}</div>
              <p className="text-xs text-muted-foreground">
                Require manual review
              </p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Filters and Search */}
      <Card>
        <CardHeader>
          <CardTitle>User Verification Management</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex gap-4 mb-4">
            <div className="flex-1">
              <Label htmlFor="search">Search Users</Label>
              <div className="relative">
                <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input
                  id="search"
                  placeholder="Search by name or email..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
            
            <div>
              <Label htmlFor="filter">Filter by Tier</Label>
              <select
                id="filter"
                value={filterTier}
                onChange={(e) => setFilterTier(e.target.value)}
                className="w-full p-2 border rounded-md"
              >
                <option value="all">All Tiers</option>
                <option value="basic">Basic</option>
                <option value="payment_verified">Payment Verified</option>
                <option value="id_verified">ID Verified</option>
                <option value="premium_verified">Premium Verified</option>
              </select>
            </div>

            <div className="flex items-end">
              <Button onClick={exportData} variant="outline">
                <Download className="h-4 w-4 mr-2" />
                Export CSV
              </Button>
            </div>
          </div>

          {/* Users Table */}
          <div className="border rounded-lg">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>User</TableHead>
                  <TableHead>Verification Tier</TableHead>
                  <TableHead>Score</TableHead>
                  <TableHead>Address Status</TableHead>
                  <TableHead>Fraud Flags</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredUsers.map((user) => (
                  <TableRow key={user.id}>
                    <TableCell>
                      <div>
                        <div className="font-medium">{user.full_name || 'N/A'}</div>
                        <div className="text-sm text-muted-foreground">{user.email}</div>
                      </div>
                    </TableCell>
                    <TableCell>
                      {getTierBadge(user.verification_tier)}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <span className="text-sm">{user.verification_score || 0}/100</span>
                        <div className="w-16 bg-gray-200 rounded-full h-2">
                          <div 
                            className="bg-blue-600 h-2 rounded-full" 
                            style={{ width: `${user.verification_score || 0}%` }}
                          />
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        {getStatusIcon(user.address_verification_status || 'pending')}
                        <span className="text-sm capitalize">
                          {user.address_verification_status || 'pending'}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell>
                      {user.fraud_flags > 0 ? (
                        <Badge variant="destructive">{user.fraud_flags}</Badge>
                      ) : (
                        <span className="text-sm text-muted-foreground">0</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <span className="text-sm">
                        {new Date(user.created_at).toLocaleDateString()}
                      </span>
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-2">
                        <Button size="sm" variant="outline">
                          View
                        </Button>
                        {user.fraud_flags > 0 && (
                          <Button size="sm" variant="destructive">
                            Review
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          {filteredUsers.length === 0 && (
            <div className="text-center py-8 text-muted-foreground">
              No users found matching your criteria.
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
