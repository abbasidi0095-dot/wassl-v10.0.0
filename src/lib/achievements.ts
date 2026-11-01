import type { Order, TaxiRide } from "./types";

export type Achievement = {
  id: string;
  title: string;
  description: string;
  earned: boolean;
  progress: string;
};

export function customerAchievements(
  orders: Order[],
  rides: TaxiRide[],
  lifetimePoints: number,
): Achievement[] {
  const delivered = orders.filter((order) => order.status === "delivered");
  const completedRides = rides.filter((ride) => ride.status === "completed");
  const grocery = delivered.filter((order) => order.fulfillment === "pickup" || order.items.some((item) => item.unit));
  const reviewed = delivered.filter((order) => order.rating).length + completedRides.filter((ride) => ride.rating).length;

  return [
    {
      id: "first_order",
      title: "First delivery",
      description: "Complete your first order.",
      earned: delivered.length >= 1,
      progress: `${Math.min(1, delivered.length)}/1`,
    },
    {
      id: "five_orders",
      title: "Regular",
      description: "Complete five orders.",
      earned: delivered.length >= 5,
      progress: `${Math.min(5, delivered.length)}/5`,
    },
    {
      id: "grocery_run",
      title: "Aisle explorer",
      description: "Complete three grocery orders.",
      earned: grocery.length >= 3,
      progress: `${Math.min(3, grocery.length)}/3`,
    },
    {
      id: "taxi_rider",
      title: "City mover",
      description: "Complete three taxi rides.",
      earned: completedRides.length >= 3,
      progress: `${Math.min(3, completedRides.length)}/3`,
    },
    {
      id: "reviewer",
      title: "Honest voice",
      description: "Rate three completed orders or rides.",
      earned: reviewed >= 3,
      progress: `${Math.min(3, reviewed)}/3`,
    },
    {
      id: "plus_member",
      title: "Plus member",
      description: "Reach 500 lifetime points.",
      earned: lifetimePoints >= 500,
      progress: `${Math.min(500, lifetimePoints)}/500`,
    },
  ];
}
